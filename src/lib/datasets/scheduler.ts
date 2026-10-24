import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/db/prisma';
import { DATASET_DEFINITIONS } from './definitions';
import { createDatasetRefreshService } from './refresh-service';

/**
 * Starts the in-app reference-data refresh (called once per server process from
 * instrumentation-node.ts). Runs in the background and never blocks requests: the first tick
 * waits a minute after start-up, then every 10 minutes it picks up versions published by other
 * replicas and refreshes whatever is due. On a fresh install every dataset is due at once.
 *
 * Enabled by default in production; DATASET_AUTO_REFRESH=true|false overrides that.
 */
const FIRST_TICK_MS = 60 * 1000;
const TICK_MS = 10 * 60 * 1000;

export function isDatasetAutoRefreshEnabled(env: Record<string, string | undefined> = process.env): boolean {
  const flag = env.DATASET_AUTO_REFRESH?.trim().toLowerCase();
  if (flag === 'true') return true;
  if (flag === 'false') return false;
  return env.NODE_ENV === 'production';
}

export function startDatasetRefreshScheduler(): void {
  const g = globalThis as unknown as { __famvacayDatasetScheduler?: boolean };
  if (g.__famvacayDatasetScheduler || !isDatasetAutoRefreshEnabled()) return;
  g.__famvacayDatasetScheduler = true;

  const service = createDatasetRefreshService({
    db: prisma,
    definitions: DATASET_DEFINITIONS,
    instanceId: randomUUID(),
  });

  let running = false;
  const tick = async () => {
    if (running) return; // a long refresh (e.g. climate on the free tier) is still going
    running = true;
    try {
      await service.tick();
    } catch (err) {
      console.warn('[datasets] refresh tick failed:', (err as Error)?.message || err);
    } finally {
      running = false;
    }
  };

  // Newer published data is picked up right away; only regeneration waits for the first tick
  void service.loadPublished().catch((err) => console.warn('[datasets] could not load published data:', err?.message || err));
  setTimeout(tick, FIRST_TICK_MS).unref();
  setInterval(tick, TICK_MS).unref();
  console.log('[datasets] background refresh enabled');
}
