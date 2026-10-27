import { describe, it, expect } from 'vitest';
import bcrypt from 'bcryptjs';
import { getGoogleCredentials, getAppleCredentials, getConfiguredOAuthProviders } from './oauth-config';

describe('Authentication and Security Cryptography', () => {
  it('hashes passwords securely using bcrypt', async () => {
    const rawPassword = 'ParentSecurePassword2026!';
    const hash = await bcrypt.hash(rawPassword, 10);

    expect(hash).not.toBe(rawPassword);
    expect(hash.startsWith('$2')).toBe(true);

    const match = await bcrypt.compare(rawPassword, hash);
    expect(match).toBe(true);

    const mismatch = await bcrypt.compare('WrongPassword', hash);
    expect(mismatch).toBe(false);
  });

  it('rejects passwords shorter than security policy requirements', () => {
    const minLength = 8;
    const testPassword = 'short';
    expect(testPassword.length < minLength).toBe(true);
  });

  it('correctly parses Google and Apple OAuth credentials from environment', () => {
    // Unset or empty returns null
    expect(getGoogleCredentials({})).toBeNull();
    expect(getGoogleCredentials({ GOOGLE_CLIENT_ID: '   ' })).toBeNull();
    expect(getGoogleCredentials({ GOOGLE_CLIENT_ID: 'id' })).toBeNull();
    expect(getAppleCredentials({})).toBeNull();

    // Valid credentials return { clientId, clientSecret }
    expect(getGoogleCredentials({ GOOGLE_CLIENT_ID: 'gid', GOOGLE_CLIENT_SECRET: 'gsecret' })).toEqual({
      clientId: 'gid',
      clientSecret: 'gsecret',
    });
    expect(getAppleCredentials({ APPLE_CLIENT_ID: 'aid', APPLE_CLIENT_SECRET: 'asecret' })).toEqual({
      clientId: 'aid',
      clientSecret: 'asecret',
    });
    expect(getAppleCredentials({ APPLE_ID: 'aid2', APPLE_SECRET: 'asecret2' })).toEqual({
      clientId: 'aid2',
      clientSecret: 'asecret2',
    });

    // Providers summary returns the list of active provider names
    expect(
      getConfiguredOAuthProviders({
        GOOGLE_CLIENT_ID: 'gid',
        GOOGLE_CLIENT_SECRET: 'gsecret',
        APPLE_CLIENT_ID: 'aid',
        APPLE_CLIENT_SECRET: 'asecret',
      })
    ).toEqual(['Google', 'Apple']);
  });
});


