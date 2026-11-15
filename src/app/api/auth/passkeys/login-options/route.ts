import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { generateAuthenticationOptions } from '@simplewebauthn/server';
import { setCached } from '@/lib/cache/redis';
import { checkRateLimit, clientIdentifierFromHeaders, RATE_LIMITS, rateLimitingEnabled } from '@/lib/security/rate-limit';
import { authChallengeKey, getRelyingParty, PASSKEY_CHALLENGE_TTL_SECONDS } from '@/lib/auth/passkey';

export const dynamic = 'force-dynamic';

/**
 * Challenge for a passkey sign-in. No email address and no allowCredentials: the passkey is
 * discoverable, so the browser or password manager (Bitwarden, ...) offers whichever passkey it
 * holds for this site and the account follows from the credential.
 */
export async function POST(req: NextRequest) {
  try {
    if (rateLimitingEnabled()) {
      const limit = await checkRateLimit(RATE_LIMITS.loginPerIp, clientIdentifierFromHeaders(Object.fromEntries(req.headers)));
      if (!limit.allowed) {
        return NextResponse.json(
          { error: 'Too many login attempts. Please try again later.' },
          { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } }
        );
      }
    }

    const { rpID } = getRelyingParty();
    const options = await generateAuthenticationOptions({ rpID, userVerification: 'preferred' });

    // The challenge is stored under a random id the client hands back at sign-in
    const challengeId = randomBytes(24).toString('base64url');
    await setCached(authChallengeKey(challengeId), options.challenge, PASSKEY_CHALLENGE_TTL_SECONDS);

    return NextResponse.json({ options, challengeId });
  } catch (error: any) {
    console.error('[WebAuthn Login Options Error]', error);
    return NextResponse.json({ error: 'Failed to start passkey sign-in.' }, { status: 500 });
  }
}
