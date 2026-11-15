import { describe, it, expect, vi, beforeEach } from 'vitest';

const verify = vi.fn();
vi.mock('@simplewebauthn/server', () => ({ verifyAuthenticationResponse: (...args: unknown[]) => verify(...args) }));
vi.mock('@/lib/db/prisma', () => ({ prisma: {} }));

const { verifyPasskeyLogin, authChallengeKey } = await import('../passkey');
const { setCached, getCached } = await import('@/lib/cache/redis');

const user = { id: 'u1', email: 'a@example.com', name: 'A', image: null };

function fakeDb(found = true) {
  const authenticator = {
    credentialID: 'cred-1',
    credentialPublicKey: Buffer.from([1, 2, 3]).toString('base64url'),
    counter: BigInt(0),
    transports: 'internal,hybrid',
    user,
  };
  return {
    authenticator: {
      findUnique: vi.fn(async () => (found ? authenticator : null)),
      update: vi.fn(async () => undefined),
    },
  } as any;
}

const response = { id: 'cred-1', rawId: 'cred-1', type: 'public-key', response: {}, clientExtensionResults: {} } as any;

describe('passkey sign-in', () => {
  beforeEach(async () => {
    verify.mockReset();
    await setCached(authChallengeKey('c1'), 'challenge', 60);
  });

  it('returns the owner of a verified passkey, stores the new counter and spends the challenge', async () => {
    verify.mockResolvedValue({
      verified: true,
      authenticationInfo: { newCounter: 0, credentialBackedUp: true, credentialDeviceType: 'multiDevice' },
    });
    const db = fakeDb();
    await expect(verifyPasskeyLogin('c1', response, db)).resolves.toEqual(user);
    expect(db.authenticator.update).toHaveBeenCalledOnce();
    expect(await getCached(authChallengeKey('c1'))).toBeNull();
    await expect(verifyPasskeyLogin('c1', response, db)).rejects.toThrow(/expired/);
  });

  it('rejects a passkey that is not registered, with a message the page can show', async () => {
    await expect(verifyPasskeyLogin('c1', response, fakeDb(false))).rejects.toThrow(/not registered/);
    expect(verify).not.toHaveBeenCalled();
  });

  it('rejects a response the library does not verify', async () => {
    verify.mockRejectedValue(new Error('Unexpected authentication response origin'));
    const db = fakeDb();
    await expect(verifyPasskeyLogin('c1', response, db)).rejects.toThrow(/could not be verified/);
    expect(db.authenticator.update).not.toHaveBeenCalled();
  });

  it('rejects incomplete input', async () => {
    await expect(verifyPasskeyLogin(undefined, response, fakeDb())).rejects.toThrow(/incomplete/);
  });
});
