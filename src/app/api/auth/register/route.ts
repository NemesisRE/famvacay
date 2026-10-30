import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db/prisma';
import { RATE_LIMITS, rateLimitByClient } from '@/lib/security/rate-limit';
import { sendEmailConfirmation } from '@/lib/auth/email-verification';
import { isMailConfigured } from '@/lib/mail/mailer';

export async function POST(req: NextRequest) {
  const limited = await rateLimitByClient(req, RATE_LIMITS.register);
  if (limited) return limited;
  try {
    const { email, password, name, locale } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required.' },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long.' },
        { status: 400 }
      );
    }

    const cleanEmail = email.toLowerCase().trim();

    const existingUser = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'An account with this email address already exists.' },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email: cleanEmail,
        name: name || null,
        passwordHash,
      },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
      },
    });

    // Confirmation link in the background: registration never waits for (or fails on) the mail
    const verificationSent = isMailConfigured();
    if (verificationSent) {
      void sendEmailConfirmation({ purpose: 'verify', userId: user.id, email: cleanEmail, locale });
    }

    return NextResponse.json(
      { success: true, message: 'Account registered successfully.', user, verificationSent },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('[Register API Error]', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error.' },
      { status: 500 }
    );
  }
}

