import { NextRequest, NextResponse } from 'next/server';
import { verifyRegistrationResponse } from '@simplewebauthn/server';
import { prisma } from '@/lib/db/prisma';
import { getCached } from '@/lib/cache/redis';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { email, credential } = await req.json();

    if (!email || !credential) {
      return NextResponse.json(
        { error: 'Email and credential payload are required.' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found.' },
        { status: 404 }
      );
    }

    const expectedChallenge = await getCached<string>(`webauthn:challenge:reg:${user.id}`);
    if (!expectedChallenge) {
      return NextResponse.json(
        { error: 'Registration challenge expired or not found. Please try again.' },
        { status: 400 }
      );
    }

    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const origin = new URL(appUrl).origin;
    const rpID = new URL(appUrl).hostname;

    const verification = await verifyRegistrationResponse({
      response: credential,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: false,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return NextResponse.json(
        { error: 'Failed to verify passkey registration.' },
        { status: 400 }
      );
    }

    const { credential: verified, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;

    // Save Authenticator credential into Prisma
    await prisma.authenticator.create({
      data: {
        userId: user.id,
        credentialID: verified.id, // already base64url
        providerAccountId: user.id,
        credentialPublicKey: Buffer.from(verified.publicKey).toString('base64url'),
        counter: BigInt(verified.counter),
        credentialDeviceType,
        credentialBackedUp,
        transports: (verified.transports ?? credential.response?.transports)?.join(',') || null,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Passkey linked to account successfully.',
    });
  } catch (error: any) {
    console.error('[WebAuthn Verify Error]', error);
    return NextResponse.json(
      { error: error.message || 'Passkey verification failed.' },
      { status: 500 }
    );
  }
}

