import { describe, it, expect } from 'vitest';
import { createRunQueue } from '../run-queue';

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('optimizer run queue', () => {
  it('runs at most `limit` tasks at once, in arrival order', async () => {
    const run = createRunQueue(1);
    const log: string[] = [];
    let running = 0;
    let maxRunning = 0;
    const releases: (() => void)[] = [];
    const task = (name: string) =>
      run(async () => {
        running++;
        maxRunning = Math.max(maxRunning, running);
        log.push(`start ${name}`);
        await new Promise<void>((resolve) => releases.push(resolve));
        running--;
        log.push(`end ${name}`);
        return name;
      });

    const results = Promise.all([task('a'), task('b'), task('c')]);
    await tick();
    expect(log).toEqual(['start a']);
    releases.shift()!();
    await tick();
    expect(log).toEqual(['start a', 'end a', 'start b']);
    releases.shift()!();
    await tick();
    releases.shift()!();
    expect(await results).toEqual(['a', 'b', 'c']);
    expect(maxRunning).toBe(1);
  });

  it('lets interactive searches overtake waiting background discovery', async () => {
    const run = createRunQueue(1);
    const order: string[] = [];
    let release!: () => void;
    const first = run(() => new Promise<void>((resolve) => (release = resolve)).then(() => order.push('a')));
    const tasks = [
      run(async () => order.push('bg1'), 'low'),
      run(async () => order.push('bg2'), 'low'),
      run(async () => order.push('b')),
      run(async () => order.push('c')),
    ];
    await tick();
    release();
    await Promise.all([first, ...tasks]);
    expect(order).toEqual(['a', 'b', 'c', 'bg1', 'bg2']);
  });

  it('frees the slot when a task fails', async () => {
    const run = createRunQueue(1);
    await expect(run(async () => Promise.reject(new Error('boom')))).rejects.toThrow('boom');
    expect(await run(async () => 'next')).toBe('next');
  });

  it('allows more parallel tasks when configured', async () => {
    const run = createRunQueue(2);
    let running = 0;
    let maxRunning = 0;
    await Promise.all(
      [1, 2, 3, 4].map(() =>
        run(async () => {
          running++;
          maxRunning = Math.max(maxRunning, running);
          await tick();
          running--;
        })
      )
    );
    expect(maxRunning).toBe(2);
  });
});
