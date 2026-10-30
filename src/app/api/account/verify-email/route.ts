import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/db/prisma';
import { sendEmailConfirmation } from '@/lib/auth/email-verification';
import { isMailConfigured } from '@/lib/mail/mailer';
import { RATE_LIMITS, rateLimitByClient } from '@/lib/security/rate-limit';

export const dynamic = 'force-dynamic';

/** Sends the confirmation link for the account's current address again */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id;
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!isMailConfigured()) {
    return NextResponse.json({ error: 'Sending mail is not configured on this server.' }, { status: 503 });
  }
  const limited = await rateLimitByClient(req, RATE_LIMITS.emailSend);
  if (limited) return limited;

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, emailVerified: true } });
  if (!user?.email) {
    return NextResponse.json({ error: 'The account has no email address.' }, { status: 400 });
  }
  if (user.emailVerified) {
    return NextResponse.json({ success: true, alreadyVerified: true });
  }

  const { locale } = await req.json().catch(() => ({ locale: undefined }));
  const sent = await sendEmailConfirmation({ purpose: 'verify', userId, email: user.email, locale });
  if (!sent) {
    return NextResponse.json({ error: 'The confirmation mail could not be sent. Please try again later.' }, { status: 502 });
  }
  return NextResponse.json({ success: true });
}
