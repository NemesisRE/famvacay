import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

export async function DELETE() {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Cascade delete user and all associated family profiles, members, passkeys, and accounts
    await prisma.user.delete({
      where: { id: userId },
    });

    return NextResponse.json({
      success: true,
      message: 'User account and all personal data permanently deleted.',
    });
  } catch (error: any) {
    console.error('[API DELETE /api/account Error]:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete account.' },
      { status: 500 }
    );
  }
}

