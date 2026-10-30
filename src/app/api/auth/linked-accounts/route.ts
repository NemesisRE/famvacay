import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/db/prisma';
import { isMailConfigured } from '@/lib/mail/mailer';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const accounts = await prisma.account.findMany({
      where: { userId },
      select: {
        id: true,
        provider: true,
        type: true,
      },
    });

    const passkeys = await prisma.authenticator.findMany({
      where: { userId },
      select: {
        credentialID: true,
        credentialDeviceType: true,
      },
    });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        passwordHash: true,
        emailVerified: true,
      },
    });

    return NextResponse.json({
      hasPassword: Boolean(user?.passwordHash),
      emailVerified: Boolean(user?.emailVerified),
      // Without mail, addresses cannot be confirmed: the settings then show no status at all
      mailEnabled: isMailConfigured(),
      linkedProviders: accounts.map((a) => a.provider),
      passkeysCount: passkeys.length,
      accounts,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

