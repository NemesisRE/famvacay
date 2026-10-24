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
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
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
  secret: process.env.NEXTAUTH_SECRET || 'famvacay_default_nextauth_secret_production_key_123',
};

