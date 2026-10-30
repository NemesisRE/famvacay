import { AuthOptions } from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import AppleProvider from 'next-auth/providers/apple';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db/prisma';
import { checkRateLimit, clientIdentifierFromHeaders, RATE_LIMITS, rateLimitingEnabled } from '@/lib/security/rate-limit';
import { getAppleCredentials, getGoogleCredentials } from './oauth-config';

const googleCredentials = getGoogleCredentials();
const appleCredentials = getAppleCredentials();

const SESSION_VERSION_CHECK_MS = 60 * 1000;

/** null when the user no longer exists */
async function currentSessionUser(userId: string) {
  return prisma.user.findUnique({ where: { id: userId }, select: { sessionVersion: true, email: true, name: true } });
}

export async function secureAccountLinkedByProvider(userId: string, db = prisma): Promise<void> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { emailVerified: true, passwordHash: true, _count: { select: { passkeys: true } } },
  });
  if (!user || user.emailVerified) return;
  const unconfirmedCredentials = Boolean(user.passwordHash) || user._count.passkeys > 0;
  await db.$transaction([
    ...(unconfirmedCredentials ? [db.authenticator.deleteMany({ where: { userId } })] : []),
    db.user.update({
      where: { id: userId },
      data: {
        emailVerified: new Date(),
        ...(unconfirmedCredentials ? { passwordHash: null, sessionVersion: { increment: 1 } } : {}),
      },
    }),
  ]);
  if (unconfirmedCredentials) {
    console.warn('[auth] provider sign-in confirmed an address of an unconfirmed account: its password, passkeys and sessions were reset');
  }
}

export const authOptions: AuthOptions = {
  // Use PrismaAdapter to persist accounts, sessions, and users
  adapter: PrismaAdapter(prisma) as any,
  session: {
    strategy: 'jwt',
  },
  providers: [
    // 1. Email and Password Credentials
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email', placeholder: 'parent@example.com' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Please enter an email and password.');
        }

        const email = credentials.email.toLowerCase().trim();
        if (rateLimitingEnabled()) {
          const [perIp, perEmail] = await Promise.all([
            checkRateLimit(RATE_LIMITS.loginPerIp, clientIdentifierFromHeaders(req?.headers)),
            checkRateLimit(RATE_LIMITS.loginPerEmail, email),
          ]);
          if (!perIp.allowed || !perEmail.allowed) {
            throw new Error('Too many login attempts. Please try again later.');
          }
        }

        const user = await prisma.user.findUnique({
          where: { email },
        });

        if (!user || !user.passwordHash) {
          throw new Error('Invalid email or password.');
        }

        const isValid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!isValid) {
          throw new Error('Invalid email or password.');
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),

    // 2. Google OAuth
    ...(googleCredentials
      ? [
          GoogleProvider({
            ...googleCredentials,
            allowDangerousEmailAccountLinking: true,
          }),
        ]
      : []),

    // 3. Apple Sign-In
    ...(appleCredentials
      ? [
          AppleProvider({
            ...appleCredentials,
            allowDangerousEmailAccountLinking: true,
          }),
        ]
      : []),
  ],
  pages: {
    signIn: '/auth/signin',
    error: '/auth/signin',
  },
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id;
        token.sv = (await currentSessionUser(user.id))?.sessionVersion ?? 0;
        token.svCheckedAt = Date.now();
        return token;
      }
      // JWTs cannot be revoked one by one: a bumped User.sessionVersion ends every older session,
      // checked at most once a minute per session (and on an explicit session update). Throwing
      // makes NextAuth clear the session cookies and answer with no session. The same lookup
      // keeps a changed email address or name current in the session.
      const due = Date.now() - Number(token.svCheckedAt || 0) > SESSION_VERSION_CHECK_MS;
      if (token.id && (due || trigger === 'update')) {
        const current = await currentSessionUser(token.id as string);
        if (!current || current.sessionVersion !== Number(token.sv ?? 0)) {
          throw new Error('Session ended: the account was deleted or its sessions were revoked');
        }
        token.email = current.email;
        token.name = current.name;
        token.svCheckedAt = Date.now();
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        (session.user as any).id = token.id as string;
      }
      return session;
    },
  },
  events: {
    // Google and Apple confirm the address themselves. If it belonged to an account whose address
    // was never confirmed, whoever registered that account may not own the address: its password,
    // passkeys and sessions are dropped, so only the real owner keeps access.
    async linkAccount({ user, account }) {
      if (account.provider !== 'google' && account.provider !== 'apple') return;
      await secureAccountLinkedByProvider(user.id);
    },
  },
  secret: process.env.NEXTAUTH_SECRET || 'famvacay_default_nextauth_secret_production_key_123',
};

