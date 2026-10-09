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

    const { email } = await req.json();
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email address is required.' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if email is already used by another account
    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existing && existing.id !== userId) {
      return NextResponse.json(
        { error: 'This email address is already in use by another account.' },
        { status: 409 }
      );
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { email: normalizedEmail },
      select: { id: true, email: true, name: true },
    });

    return NextResponse.json({
      success: true,
      message: 'Email updated successfully.',
      user: updated,
    });
  } catch (error: any) {
    console.error('[API /api/account/email Error]:', error);
    return NextResponse.json({ error: error.message || 'Failed to update email.' }, { status: 500 });
  }
}

