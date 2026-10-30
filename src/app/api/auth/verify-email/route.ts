import { NextRequest, NextResponse } from 'next/server';
import { consumeEmailToken } from '@/lib/auth/email-verification';
import { appBaseUrl } from '@/lib/mail/templates';
import { RATE_LIMITS, rateLimitByClient } from '@/lib/security/rate-limit';

export const dynamic = 'force-dynamic';

/**
 * Target of the link in confirmation mails: applies it and sends the browser to the account
 * settings, which show the outcome (?email=verified|changed|invalid|expired|taken).
 */
export async function GET(req: NextRequest) {
  const limited = await rateLimitByClient(req, RATE_LIMITS.emailToken);
  if (limited) return limited;
  let status = 'invalid';
  try {
    status = (await consumeEmailToken(req.nextUrl.searchParams.get('token') || '')).status;
  } catch (err) {
    console.error('[API /api/auth/verify-email] Error:', err);
  }
  return NextResponse.redirect(`${appBaseUrl()}/profile?email=${status}`, 303);
}
