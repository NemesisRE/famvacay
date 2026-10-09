import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { provider } = await req.json();
    if (!provider) {
      return NextResponse.json({ error: 'Provider is required.' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        accounts: true,
        passkeys: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    // Safety check against lockout
    const hasPassword = Boolean(user.passwordHash);
    const hasPasskeys = user.passkeys.length > 0;
    const remainingAccounts = user.accounts.filter((a) => a.provider !== provider).length;

    if (!hasPassword && !hasPasskeys && remainingAccounts === 0) {
      return NextResponse.json(
        {
          error:
            'Cannot unlink your only login method. Please set a password or enroll a passkey first.',
        },
        { status: 403 }
      );
    }

    await prisma.account.deleteMany({
      where: {
        userId,
        provider,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Successfully unlinked ${provider} account.`,
    });
  } catch (error: any) {
    console.error('[API POST /api/account/unlink Error]:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to unlink account.' },
      { status: 500 }
    );
  }
}

