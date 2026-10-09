import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const passkeys = await prisma.authenticator.findMany({
      where: { userId },
      select: {
        credentialID: true,
        credentialDeviceType: true,
        providerAccountId: true,
        transports: true,
      },
    });

    return NextResponse.json({
      success: true,
      passkeys,
    });
  } catch (error: any) {
    console.error('[API GET /api/account/passkeys Error]:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to list passkeys.' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { credentialID } = await req.json();
    if (!credentialID) {
      return NextResponse.json({ error: 'credentialID is required.' }, { status: 400 });
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

    // Safety check against lockout:
    // If user has no password and no OAuth accounts, and has only 1 passkey, prevent deletion
    const hasPassword = Boolean(user.passwordHash);
    const hasOAuth = user.accounts.length > 0;
    const remainingPasskeys = user.passkeys.filter((p) => p.credentialID !== credentialID).length;

    if (!hasPassword && !hasOAuth && remainingPasskeys === 0) {
      return NextResponse.json(
        {
          error:
            'Cannot delete your only login method. Please set a password or link another account before removing this passkey.',
        },
        { status: 403 }
      );
    }

    await prisma.authenticator.deleteMany({
      where: {
        userId,
        credentialID,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Passkey deleted successfully.',
    });
  } catch (error: any) {
    console.error('[API DELETE /api/account/passkeys Error]:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete passkey.' },
      { status: 500 }
    );
  }
}

