import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { generateRegistrationOptions } from '@simplewebauthn/server';
import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/db/prisma';
import { setCached } from '@/lib/cache/redis';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    let email = session?.user?.email;

    // If not logged in, email can be provided in request body to register passkey during onboarding
    if (!email) {
      const body = await req.json().catch(() => ({}));
      email = body.email;
    }

    if (!email) {
      return NextResponse.json(
        { error: 'User email is required to register a passkey.' },
        { status: 400 }
      );
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
    // RP ID derived from APP_URL or default to localhost
    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const rpID = new URL(appUrl).hostname;

    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userID: user.id,
      userName: user.email || user.id,
      userDisplayName: user.name || user.email || 'Parent',
      attestationType: 'none',
      excludeCredentials: user.passkeys.map((p) => ({
        id: Buffer.from(p.credentialID, 'base64url') as unknown as BufferSource,
        type: 'public-key' as const,
        transports: p.transports ? (p.transports.split(',') as any) : undefined,
      })),
      authenticatorSelection: {
        residentKey: 'preferred',
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
