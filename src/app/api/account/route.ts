import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/account
 * GDPR Data Export: Returns all personal data associated with the user account,
 * including profiles, members, sessions, authenticators, and linked accounts.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userData = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        emailVerified: true,
        image: true,
        createdAt: true,
        updatedAt: true,
        accounts: {
          select: {
            id: true,
            provider: true,
            providerAccountId: true,
            type: true,
          },
        },
        sessions: {
          select: {
            id: true,
            expires: true,
          },
        },
        passkeys: {
          select: {
            credentialID: true,
            credentialDeviceType: true,
            credentialBackedUp: true,
            transports: true,
          },
        },
        memberships: {
          include: {
            familyProfile: {
              include: {
                members: true,
                blackoutPeriods: true,
                preferredAirports: true,
              },
            },
          },
        },
      },
    });

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      exportDate: new Date().toISOString(),
      gdprNotice: 'Article 20 GDPR Data Portability Export for FamVacay.',
      user: userData,
    });
  } catch (error: any) {
    console.error('[API GET /api/account Error]:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to export account data.' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/account
 * GDPR-compliant deletion:
 * If a family profile has other members, only the user's membership is removed.
 * The family profile is deleted only with its last member.
 * Completely removes personal data, sessions, linked accounts, and passkeys.
 */
export async function DELETE() {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Find all family profiles the user belongs to
    const memberships = await prisma.familyMembership.findMany({
      where: { userId },
      select: { familyProfileId: true },
    });

    const directProfiles = await prisma.familyProfile.findMany({
      where: { userId },
      select: { id: true },
    });

    const profileIds = new Set<string>([
      ...memberships.map((m) => m.familyProfileId),
      ...directProfiles.map((p) => p.id),
    ]);

    // 2. Process each profile: delete membership or delete entire profile if last member
    for (const profileId of profileIds) {
      const remainingMembersCount = await prisma.familyMembership.count({
        where: {
          familyProfileId: profileId,
          userId: { not: userId },
        },
      });

      if (remainingMembersCount > 0) {
        // Other family members exist: unlink this user and delete membership only
        await prisma.familyMembership.deleteMany({
          where: { familyProfileId: profileId, userId },
        });

        // Clear legacy userId pointer on profile if pointing to this user
        await prisma.familyProfile.updateMany({
          where: { id: profileId, userId },
          data: { userId: null },
        });
      } else {
        // User was the last member: delete the entire family profile
        await prisma.familyProfile.delete({
          where: { id: profileId },
        });
      }
    }

    // 3. Delete user record (cascades sessions, accounts, and authenticators)
    await prisma.user.delete({
      where: { id: userId },
    });

    return NextResponse.json({
      success: true,
      message: 'User account and all personal data permanently deleted.',
    });
  } catch (error: any) {
    console.error('[API DELETE /api/account Error]:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete account.' },
      { status: 500 }
    );
  }
}
