import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/db/prisma';
import { sendEmailConfirmation } from '@/lib/auth/email-verification';
import { isMailConfigured } from '@/lib/mail/mailer';
import { RATE_LIMITS, rateLimitByClient } from '@/lib/security/rate-limit';

export const dynamic = 'force-dynamic';

/**
 * Change the account's address. With mail configured the new address must be confirmed first
 * (a link goes there, the account keeps the old address until it is opened) - otherwise anyone
 * with a session could move an account to an address nobody controls. Without mail the change
 * applies directly and the address counts as unconfirmed.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { email, locale } = await req.json();
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
    if (existing?.id === userId) {
      return NextResponse.json({ success: true, pending: false, user: { id: userId, email: normalizedEmail } });
    }

    if (isMailConfigured()) {
      const limited = await rateLimitByClient(req, RATE_LIMITS.emailSend);
      if (limited) return limited;
      const sent = await sendEmailConfirmation({ purpose: 'change', userId, email: normalizedEmail, locale });
      if (!sent) {
        return NextResponse.json({ error: 'The confirmation mail could not be sent. Please try again later.' }, { status: 502 });
      }
      return NextResponse.json({ success: true, pending: true, email: normalizedEmail });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { email: normalizedEmail, emailVerified: null },
      select: { id: true, email: true, name: true },
    });

    return NextResponse.json({
      success: true,
      pending: false,
      message: 'Email updated successfully.',
      user: updated,
    });
  } catch (error: any) {
    console.error('[API /api/account/email Error]:', error);
    return NextResponse.json({ error: error.message || 'Failed to update email.' }, { status: 500 });
  }
}
