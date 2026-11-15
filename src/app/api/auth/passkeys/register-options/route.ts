import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { generateRegistrationOptions, type AuthenticatorTransport } from '@simplewebauthn/server';
import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/db/prisma';
import { setCached } from '@/lib/cache/redis';
import { getRelyingParty } from '@/lib/auth/passkey';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    // Only a signed-in user may add a passkey to an account. Passkeys now sign in, so enrolling one
    // for an arbitrary email address would be an account takeover.
    const email = session?.user?.email;
    if (!email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: { passkeys: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User account not found.' },
        { status: 404 }
      );
    }

    const rpName = 'FamVacay';
    const { rpID } = getRelyingParty();

    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      // Same user handle bytes as before v10 of the library (UTF-8 of the user id)
      userID: new TextEncoder().encode(user.id),
      userName: user.email || user.id,
      userDisplayName: user.name || user.email || 'Parent',
      attestationType: 'none',
      excludeCredentials: user.passkeys.map((p) => ({
        id: p.credentialID, // stored as base64url
        transports: p.transports ? (p.transports.split(',') as AuthenticatorTransport[]) : undefined,
      })),
      authenticatorSelection: {
        // Discoverable credential: sign-in starts without an email address, password managers
        // such as Bitwarden only offer such passkeys in that case
        residentKey: 'required',
        userVerification: 'preferred',
      },
    });

    // Cache challenge in Redis for 5 minutes
    await setCached(`webauthn:challenge:reg:${user.id}`, options.challenge, 300);

    return NextResponse.json(options);
  } catch (error: any) {
    console.error('[WebAuthn Options Error]', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate passkey options' },
      { status: 500 }
    );
  }
}
