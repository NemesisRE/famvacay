import { createHash, randomBytes } from 'node:crypto';
import { prisma } from '@/lib/db/prisma';
import { isMailConfigured, sendMail } from '@/lib/mail/mailer';
import { appBaseUrl, emailConfirmationMail } from '@/lib/mail/templates';

/**
 * Email confirmation links: after registration (`verify`) and before an address change takes
 * effect (`change`, the new address must be confirmed first). Stored in NextAuth's
 * VerificationToken table under "<purpose>:<userId>:<email>", only as a SHA-256 hash - a database
 * leak does not leak usable links. One open link per user and purpose; a new one replaces it.
 */
export type EmailTokenPurpose = 'verify' | 'change';

export const EMAIL_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

export type ConsumeResult =
  | { status: 'verified' | 'changed'; userId: string }
  | { status: 'invalid' | 'expired' | 'taken' };

interface TokenDb {
  verificationToken: {
    deleteMany(args: { where: { identifier: { startsWith: string } } | { token: string } }): Promise<unknown>;
    create(args: { data: { identifier: string; token: string; expires: Date } }): Promise<unknown>;
    findUnique(args: { where: { token: string } }): Promise<{ identifier: string; token: string; expires: Date } | null>;
  };
  user: {
    findUnique(args: { where: { id: string } | { email: string }; select: { id: true; email: true } }): Promise<{ id: string; email: string | null } | null>;
    update(args: { where: { id: string }; data: { email?: string; emailVerified: Date } }): Promise<unknown>;
  };
}

const hashToken = (raw: string) => createHash('sha256').update(raw).digest('hex');

export async function issueEmailToken(
  purpose: EmailTokenPurpose,
  userId: string,
  email: string,
  db: TokenDb = prisma as unknown as TokenDb,
  now = Date.now()
): Promise<string> {
  const raw = randomBytes(32).toString('base64url');
  await db.verificationToken.deleteMany({ where: { identifier: { startsWith: `${purpose}:${userId}:` } } });
  await db.verificationToken.create({
    data: { identifier: `${purpose}:${userId}:${email}`, token: hashToken(raw), expires: new Date(now + EMAIL_TOKEN_TTL_MS) },
  });
  return raw;
}

/** Applies a link once: confirms the address, or switches the account to the new one */
export async function consumeEmailToken(
  raw: string,
  db: TokenDb = prisma as unknown as TokenDb,
  now = Date.now()
): Promise<ConsumeResult> {
  if (!raw || raw.length > 200) return { status: 'invalid' };
  const token = hashToken(raw);
  const stored = await db.verificationToken.findUnique({ where: { token } });
  if (!stored) return { status: 'invalid' };
  // Single use, also when expired or no longer applicable
  await db.verificationToken.deleteMany({ where: { token } });
  if (stored.expires.getTime() < now) return { status: 'expired' };

  const [purpose, userId, ...rest] = stored.identifier.split(':');
  const email = rest.join(':');
  if ((purpose !== 'verify' && purpose !== 'change') || !userId || !email) return { status: 'invalid' };

  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, email: true } });
  if (!user) return { status: 'invalid' };

  if (purpose === 'verify') {
    // The address was changed since the link was sent: it confirms nothing any more
    if (user.email !== email) return { status: 'invalid' };
    await db.user.update({ where: { id: userId }, data: { emailVerified: new Date(now) } });
    return { status: 'verified', userId };
  }

  const owner = await db.user.findUnique({ where: { email }, select: { id: true, email: true } });
  if (owner && owner.id !== userId) return { status: 'taken' };
  try {
    await db.user.update({ where: { id: userId }, data: { email, emailVerified: new Date(now) } });
  } catch {
    // Registered by someone else in the meantime (unique email)
    return { status: 'taken' };
  }
  return { status: 'changed', userId };
}

/**
 * Sends the confirmation link; false when mail is not configured or sending failed. Never
 * throws - registration and address changes go on without it.
 */
export async function sendEmailConfirmation(params: {
  purpose: EmailTokenPurpose;
  userId: string;
  email: string;
  locale?: string | null;
}): Promise<boolean> {
  if (!isMailConfigured()) return false;
  try {
    const raw = await issueEmailToken(params.purpose, params.userId, params.email);
    const url = `${appBaseUrl()}/api/auth/verify-email?token=${encodeURIComponent(raw)}`;
    return await sendMail(emailConfirmationMail({ locale: params.locale, to: params.email, url, kind: params.purpose }));
  } catch (err) {
    console.warn('[auth] could not send the confirmation link:', (err as Error)?.message || err);
    return false;
  }
}
