import { createHash } from 'node:crypto';
import { gunzipSync, gzipSync } from 'node:zlib';
import { getDataset, getDatasetVersion, publishDataset, type DatasetName } from './store';
import type { DatasetDefinition } from './definitions';
import { defaultGeneratorContext } from './generators/common';

/**
 * Background refresh of the reference datasets, run by the app itself (see scheduler.ts):
 * - loads versions published by any replica into this process (newest wins),
 * - regenerates datasets that are due, one replica at a time (lease in Postgres),
 * - publishes a new version only when the data changed and passed its sanity check.
 * Until the first refresh of a dataset lands, everyone keeps using the JSON bundled in the repo.
 */

const LEASE_MS = 15 * 60 * 1000;
const LEASE_RENEW_MS = 5 * 60 * 1000;
const ERROR_RETRY_MS = 6 * 60 * 60 * 1000;

interface DatasetRow {
  name: string;
  version: number;
  payload?: Uint8Array | null;
  payloadSha256?: string | null;
  generatorState?: Uint8Array | null;
  nextDueAt?: Date | null;
  leaseOwner?: string | null;
  leaseUntil?: Date | null;
}

/** The subset of the Prisma client used here (a fake implements it in tests). */
export interface DatasetDb {
  generatedDataset: {
    findMany(args: any): Promise<DatasetRow[]>;
    findUnique(args: any): Promise<DatasetRow | null>;
    upsert(args: any): Promise<unknown>;
    update(args: any): Promise<unknown>;
    updateMany(args: any): Promise<{ count: number }>;
  };
}

export interface RefreshServiceOptions {
  db: DatasetDb;
  definitions: DatasetDefinition[];
  instanceId: string;
  now?: () => Date;
  log?: (message: string) => void;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}

const gzipJson = (value: unknown) => gzipSync(Buffer.from(JSON.stringify(value)));
const gunzipJson = (bytes: Uint8Array) => JSON.parse(gunzipSync(Buffer.from(bytes)).toString('utf8'));
const sha256 = (json: string) => createHash('sha256').update(json).digest('hex');

export function createDatasetRefreshService(options: RefreshServiceOptions) {
  const { db, definitions, instanceId } = options;
  const now = options.now ?? (() => new Date());
  const log = options.log ?? ((m: string) => console.log(`[datasets] ${m}`));

  /** Load every dataset version newer than the one this process holds. */
  async function loadPublished(): Promise<DatasetName[]> {
    const rows = await db.generatedDataset.findMany({ select: { name: true, version: true } });
    const loaded: DatasetName[] = [];
    for (const row of rows) {
      const def = definitions.find((d) => d.name === row.name);
      if (!def || row.version <= getDatasetVersion(def.name)) continue;
      const full = await db.generatedDataset.findUnique({ where: { name: row.name } });
      if (!full?.payload) continue;
      try {
        if (publishDataset(def.name, gunzipJson(full.payload), full.version)) loaded.push(def.name);
      } catch (err) {
        log(`${def.name}: could not load published version ${full.version}: ${(err as Error).message}`);
      }
    }
    if (loaded.length) log(`loaded published ${loaded.join(', ')}`);
    return loaded;
  }

  async function acquireLease(name: DatasetName): Promise<boolean> {
    try {
      await db.generatedDataset.upsert({ where: { name }, create: { name }, update: {} });
    } catch {
      // Another replica created the row at the same moment - fine
    }
    const t = now();
    const { count } = await db.generatedDataset.updateMany({
      where: { name, OR: [{ leaseUntil: null }, { leaseUntil: { lt: t } }, { leaseOwner: instanceId }] },
      data: { leaseOwner: instanceId, leaseUntil: new Date(t.getTime() + LEASE_MS) },
    });
    return count === 1;
  }

  /** Writes the result and releases the lease; false when the lease was lost in the meantime. */
  async function releaseLease(name: DatasetName, data: Record<string, unknown>): Promise<boolean> {
    const { count } = await db.generatedDataset.updateMany({
      where: { name, leaseOwner: instanceId },
      data: { ...data, leaseOwner: null, leaseUntil: null },
    });
    return count === 1;
  }

  /** Regenerate one dataset if it is due and no other replica is on it. Returns what happened. */
  async function refreshIfDue(def: DatasetDefinition): Promise<'not-due' | 'busy' | 'published' | 'unchanged' | 'rejected' | 'failed'> {
    const row = await db.generatedDataset.findUnique({ where: { name: def.name } });
    if (row?.nextDueAt && row.nextDueAt > now()) return 'not-due';
    if (!(await acquireLease(def.name))) return 'busy';

    // Re-check under the lease: another replica may have finished it a moment ago
    const fresh = await db.generatedDataset.findUnique({ where: { name: def.name } });
    if (fresh?.nextDueAt && fresh.nextDueAt > now()) {
      await releaseLease(def.name, {});
      return 'not-due';
    }

    const renew = setInterval(() => {
      void db.generatedDataset
        .updateMany({ where: { name: def.name, leaseOwner: instanceId }, data: { leaseUntil: new Date(now().getTime() + LEASE_MS) } })
        .catch(() => {});
    }, LEASE_RENEW_MS);
    (renew as { unref?: () => void }).unref?.();

    const startedAt = now();
    try {
      log(`${def.name}: refreshing...`);
      const ctx = {
        ...defaultGeneratorContext((m) => log(`${def.name}: ${m}`)),
        ...(options.fetchImpl ? { fetch: options.fetchImpl } : {}),
        ...(options.sleep ? { sleep: options.sleep } : {}),
        loadState: async () => (fresh?.generatorState ? gunzipJson(fresh.generatorState) : null),
        saveState: async (state: unknown) => {
          await db.generatedDataset.updateMany({
            where: { name: def.name, leaseOwner: instanceId },
            data: { generatorState: gzipJson(state) },
          });
        },
      };
      const result = await def.run(ctx);
      const nextDueAt = new Date(
        now().getTime() + (result.incomplete && def.incompleteRetryMs ? def.incompleteRetryMs : def.refreshIntervalMs)
      );

      const problem = def.validate(result.data, getDataset(def.name, def.seed));
      if (problem) {
        log(`${def.name}: rejected, not published - ${problem}`);
        await releaseLease(def.name, { lastAttemptAt: startedAt, lastError: `rejected: ${problem}`, nextDueAt: new Date(now().getTime() + ERROR_RETRY_MS) });
        return 'rejected';
      }

      const json = JSON.stringify(result.data);
      const hash = sha256(json);
      if (hash === fresh?.payloadSha256) {
        log(`${def.name}: unchanged`);
        await releaseLease(def.name, { lastAttemptAt: startedAt, lastError: null, nextDueAt });
        return 'unchanged';
      }

      const version = (fresh?.version ?? 0) + 1;
      const stored = await releaseLease(def.name, {
        version,
        payload: gzipSync(Buffer.from(json)),
        payloadSha256: hash,
        publishedAt: now(),
        lastAttemptAt: startedAt,
        lastError: null,
        nextDueAt,
      });
      if (!stored) {
        // Lease expired and another replica took over: its result wins, don't publish ours
        log(`${def.name}: lease lost during refresh, result discarded`);
        return 'failed';
      }
      publishDataset(def.name, result.data, version);
      log(`${def.name}: published version ${version}${result.incomplete ? ' (more to come)' : ''}`);
      return 'published';
    } catch (err) {
      const message = (err as Error)?.message || String(err);
      log(`${def.name}: refresh failed - ${message}`);
      await releaseLease(def.name, {
        lastAttemptAt: startedAt,
        lastError: message.slice(0, 1_000),
        nextDueAt: new Date(now().getTime() + ERROR_RETRY_MS),
      }).catch(() => {});
      return 'failed';
    } finally {
      clearInterval(renew);
    }
  }

  /** One scheduler tick: pick up other replicas' work, then refresh what is due, in order. */
  async function tick(): Promise<void> {
    await loadPublished();
    for (const def of definitions) await refreshIfDue(def);
  }

  return { loadPublished, refreshIfDue, tick };
}
