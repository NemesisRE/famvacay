import { verifyAuthenticationResponse, type AuthenticationResponseJSON, type AuthenticatorTransport } from '@simplewebauthn/server';
import { prisma } from '@/lib/db/prisma';
import { getCached, deleteCached } from '@/lib/cache/redis';

export const PASSKEY_CHALLENGE_TTL_SECONDS = 300;

export const authChallengeKey = (challengeId: string) => `webauthn:challenge:auth:${challengeId}`;

/** Relying party of the passkeys: the host and origin the app is served from (APP_URL). */
export function getRelyingParty() {
  const appUrl = process.env.APP_URL || 'http://localhost:3000';
  const url = new URL(appUrl);
  return { rpID: url.hostname, origin: url.origin };
}

export interface PasskeyUser {
  id: string;
  email: string | null;
  name: string | null;
  image: string | null;
}

/**
 * Checks a passkey sign-in response against the single-use challenge it was issued for and returns
 * the account it belongs to. Throws an Error with a user-facing message otherwise.
 */
export async function verifyPasskeyLogin(
  challengeId: unknown,
  response: AuthenticationResponseJSON | undefined,
  db = prisma
): Promise<PasskeyUser> {
  if (typeof challengeId !== 'string' || !challengeId || !response?.id) {
    throw new Error('Passkey sign-in data is incomplete. Please try again.');
  }

  const expectedChallenge = await getCached<string>(authChallengeKey(challengeId));
  // Single use: whatever happens next, this challenge cannot be replayed
  await deleteCached(authChallengeKey(challengeId));
  if (!expectedChallenge) {
    throw new Error('The passkey sign-in expired. Please try again.');
  }

  const authenticator = await db.authenticator.findUnique({
    where: { credentialID: response.id },
    include: { user: { select: { id: true, email: true, name: true, image: true } } },
  });
  if (!authenticator) {
    throw new Error('This passkey is not registered with this account. Sign in another way and add it under account settings.');
  }

  const { origin, rpID } = getRelyingParty();
  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: false,
      credential: {
        id: authenticator.credentialID,
        publicKey: new Uint8Array(Buffer.from(authenticator.credentialPublicKey, 'base64url')),
        counter: Number(authenticator.counter),
        transports: authenticator.transports ? (authenticator.transports.split(',') as AuthenticatorTransport[]) : undefined,
      },
    });
  } catch (err) {
    console.warn('[passkey] sign-in verification failed:', err instanceof Error ? err.message : err);
    throw new Error('The passkey could not be verified. Please try again.');
  }
  if (!verification.verified) {
    throw new Error('The passkey could not be verified. Please try again.');
  }

  await db.authenticator.update({
    where: { credentialID: authenticator.credentialID },
    data: {
      counter: BigInt(verification.authenticationInfo.newCounter),
      credentialBackedUp: verification.authenticationInfo.credentialBackedUp,
      credentialDeviceType: verification.authenticationInfo.credentialDeviceType,
    },
  });

  return authenticator.user;
}
