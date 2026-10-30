import { describe, it, expect } from 'vitest';
import { consumeEmailToken, issueEmailToken, EMAIL_TOKEN_TTL_MS } from '../email-verification';

interface Token {
  identifier: string;
  token: string;
  expires: Date;
}
interface User {
  id: string;
  email: string | null;
  emailVerified: Date | null;
}

/** In-memory stand-in for the two Prisma models the token logic uses */
function fakeDb(users: User[]) {
  const tokens: Token[] = [];
  const db = {
    tokens,
    users,
    verificationToken: {
      async deleteMany({ where }: { where: { identifier?: { startsWith: string }; token?: string } }) {
        for (let i = tokens.length - 1; i >= 0; i--) {
          const t = tokens[i];
          if (where.token ? t.token === where.token : t.identifier.startsWith(where.identifier!.startsWith)) tokens.splice(i, 1);
        }
      },
      async create({ data }: { data: Token }) {
        tokens.push(data);
      },
      async findUnique({ where }: { where: { token: string } }) {
        return tokens.find((t) => t.token === where.token) ?? null;
      },
    },
    user: {
      async findUnique({ where }: { where: { id?: string; email?: string } }) {
        const u = users.find((x) => (where.id ? x.id === where.id : x.email === where.email));
        return u ? { id: u.id, email: u.email } : null;
      },
      async update({ where, data }: { where: { id: string }; data: Partial<User> }) {
        const u = users.find((x) => x.id === where.id)!;
        if (data.email && users.some((x) => x.email === data.email && x.id !== u.id)) throw new Error('P2002');
        Object.assign(u, data);
      },
    },
  };
  return db;
}

describe('email confirmation links', () => {
  it('confirms the address once, and stores only a hash of the link token', async () => {
    const db = fakeDb([{ id: 'u1', email: 'anna@example.org', emailVerified: null }]);
    const raw = await issueEmailToken('verify', 'u1', 'anna@example.org', db as never);

    expect(db.tokens).toHaveLength(1);
    expect(db.tokens[0].token).not.toContain(raw);
    expect(db.tokens[0].identifier).toBe('verify:u1:anna@example.org');

    expect(await consumeEmailToken(raw, db as never)).toEqual({ status: 'verified', userId: 'u1' });
    expect(db.users[0].emailVerified).toBeInstanceOf(Date);
    // Single use
    expect((await consumeEmailToken(raw, db as never)).status).toBe('invalid');
  });

  it('replaces an older link of the same kind', async () => {
    const db = fakeDb([{ id: 'u1', email: 'anna@example.org', emailVerified: null }]);
    const first = await issueEmailToken('verify', 'u1', 'anna@example.org', db as never);
    const second = await issueEmailToken('verify', 'u1', 'anna@example.org', db as never);
    expect((await consumeEmailToken(first, db as never)).status).toBe('invalid');
    expect((await consumeEmailToken(second, db as never)).status).toBe('verified');
  });

  it('rejects expired links and links for an address the account no longer has', async () => {
    const now = Date.parse('2027-01-01T00:00:00Z');
    const db = fakeDb([{ id: 'u1', email: 'anna@example.org', emailVerified: null }]);
    const raw = await issueEmailToken('verify', 'u1', 'anna@example.org', db as never, now);
    expect((await consumeEmailToken(raw, db as never, now + EMAIL_TOKEN_TTL_MS + 1)).status).toBe('expired');

    const again = await issueEmailToken('verify', 'u1', 'anna@example.org', db as never, now);
    db.users[0].email = 'other@example.org';
    expect((await consumeEmailToken(again, db as never, now)).status).toBe('invalid');
    expect(db.users[0].emailVerified).toBeNull();
  });

  it('switches the address only when the new one is confirmed, and never onto a taken one', async () => {
    const db = fakeDb([
      { id: 'u1', email: 'old@example.org', emailVerified: new Date() },
      { id: 'u2', email: 'taken@example.org', emailVerified: null },
    ]);
    const raw = await issueEmailToken('change', 'u1', 'new@example.org', db as never);
    expect(db.users[0].email).toBe('old@example.org');
    expect(await consumeEmailToken(raw, db as never)).toEqual({ status: 'changed', userId: 'u1' });
    expect(db.users[0].email).toBe('new@example.org');

    const taken = await issueEmailToken('change', 'u1', 'taken@example.org', db as never);
    expect((await consumeEmailToken(taken, db as never)).status).toBe('taken');
    expect(db.users[0].email).toBe('new@example.org');
  });

  it('treats garbage as invalid', async () => {
    const db = fakeDb([]);
    expect((await consumeEmailToken('', db as never)).status).toBe('invalid');
    expect((await consumeEmailToken('x'.repeat(500), db as never)).status).toBe('invalid');
    expect((await consumeEmailToken('nope', db as never)).status).toBe('invalid');
  });
});
