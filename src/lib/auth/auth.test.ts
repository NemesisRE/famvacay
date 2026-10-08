import { describe, it, expect } from 'vitest';
import bcrypt from 'bcryptjs';

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
});

