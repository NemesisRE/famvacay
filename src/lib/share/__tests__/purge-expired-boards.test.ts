import { describe, expect, it, vi } from 'vitest';
import { purgeExpiredBoards } from '../purge-expired-boards';

describe('purgeExpiredBoards', () => {
  it('deletes only boards whose expiry date has passed', async () => {
    const deleteMany = vi.fn().mockResolvedValue({ count: 2 });
    const now = new Date('2026-10-24T12:00:00Z');
    await expect(purgeExpiredBoards({ sharedTripBoard: { deleteMany } }, now)).resolves.toBe(2);
    expect(deleteMany).toHaveBeenCalledWith({ where: { expiresAt: { lt: now } } });
  });
});
