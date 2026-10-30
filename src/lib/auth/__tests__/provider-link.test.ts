import { describe, it, expect, vi } from 'vitest';
import { secureAccountLinkedByProvider } from '../auth-options';

interface FakeUser {
  emailVerified: Date | null;
  passwordHash: string | null;
  passkeys: number;
  sessionVersion: number;
}

/** The few Prisma calls the provider-link hardening makes, against one in-memory user */
function fakeDb(user: FakeUser | null) {
  const ops: string[] = [];
  const db = {
    user: {
      findUnique: vi.fn(async () =>
        user ? { emailVerified: user.emailVerified, passwordHash: user.passwordHash, _count: { passkeys: user.passkeys } } : null
      ),
      update: vi.fn(async ({ data }: any) => {
        ops.push('update');
        if (!user) return;
        if ('emailVerified' in data) user.emailVerified = data.emailVerified;
        if ('passwordHash' in data) user.passwordHash = data.passwordHash;
        if (data.sessionVersion?.increment) user.sessionVersion += data.sessionVersion.increment;
      }),
    },
    authenticator: {
      deleteMany: vi.fn(async () => {
        ops.push('deletePasskeys');
        if (user) user.passkeys = 0;
      }),
    },
    // The real client runs the operations atomically; here they already ran when built
    $transaction: vi.fn(async (operations: Promise<unknown>[]) => Promise.all(operations)),
  };
  return { db, ops };
}

describe('Google/Apple sign-in on an unconfirmed address', () => {
  it('drops the password, passkeys and sessions of whoever registered the address unconfirmed', async () => {
    const user: FakeUser = { emailVerified: null, passwordHash: 'hash-set-by-someone', passkeys: 2, sessionVersion: 3 };
    const { db, ops } = fakeDb(user);
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    await secureAccountLinkedByProvider('u1', db as never);

    expect(user).toMatchObject({ passwordHash: null, passkeys: 0, sessionVersion: 4 });
    expect(user.emailVerified).toBeInstanceOf(Date);
    expect(ops).toEqual(['deletePasskeys', 'update']);
  });

  it('only confirms the address of a new provider-only account', async () => {
    const user: FakeUser = { emailVerified: null, passwordHash: null, passkeys: 0, sessionVersion: 0 };
    const { db, ops } = fakeDb(user);
    await secureAccountLinkedByProvider('u1', db as never);
    expect(user.sessionVersion).toBe(0);
    expect(user.emailVerified).toBeInstanceOf(Date);
    expect(ops).toEqual(['update']);
  });

  it('leaves confirmed accounts alone', async () => {
    const confirmed = new Date('2027-01-01');
    const user: FakeUser = { emailVerified: confirmed, passwordHash: 'own-hash', passkeys: 1, sessionVersion: 0 };
    const { db, ops } = fakeDb(user);
    await secureAccountLinkedByProvider('u1', db as never);
    expect(user).toMatchObject({ emailVerified: confirmed, passwordHash: 'own-hash', passkeys: 1, sessionVersion: 0 });
    expect(ops).toEqual([]);
  });
});
