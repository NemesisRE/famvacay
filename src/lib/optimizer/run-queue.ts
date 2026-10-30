/**
 * Runs heavy optimizer computations one at a time (per server process).
 *
 * A single search briefly needs up to ~1 GB of heap while it builds and prunes its candidate
 * windows. The optimizer is synchronous and CPU-bound, so running several at once in one Node
 * process gains no throughput - it only stacks those peaks until the process runs out of memory
 * (two concurrent users with background discovery were enough to crash a 1 GB container).
 * Queued searches simply wait; someone waiting for their first results goes before background
 * discovery (`low` priority). OPTIMIZER_CONCURRENCY raises the limit for big hosts.
 */
export type RunPriority = 'high' | 'low';

export function createRunQueue(limit: number) {
  let active = 0;
  const waiting: { priority: RunPriority; start: () => void }[] = [];

  return async function run<T>(task: () => Promise<T>, priority: RunPriority = 'high'): Promise<T> {
    if (active >= limit) {
      await new Promise<void>((start) => {
        // High priority goes before every waiting low-priority task, but after earlier high ones
        const index = priority === 'high' ? waiting.findIndex((w) => w.priority === 'low') : -1;
        waiting.splice(index === -1 ? waiting.length : index, 0, { priority, start });
      });
    } else {
      active++;
    }
    try {
      return await task();
    } finally {
      // Hand the slot straight to the next waiting task (active stays the same), or free it
      const next = waiting.shift();
      if (next) next.start();
      else active--;
    }
  };
}

const configured = Number(process.env.OPTIMIZER_CONCURRENCY);
export const runOptimizerTask = createRunQueue(Number.isInteger(configured) && configured > 0 ? configured : 1);
