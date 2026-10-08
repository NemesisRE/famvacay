import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/family-profile
 * Retrieve family profile for currently authenticated user, or empty default.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const profile = await prisma.familyProfile.findUnique({
      where: { userId },
      include: {
        members: {
          orderBy: { birthDate: 'asc' },
        },
        blackoutRanges: true,
      },
    });

    if (!profile) {
      return NextResponse.json({ profile: null });
    }

    return NextResponse.json({ profile });
  } catch (error: any) {
    console.error('[GET /api/family-profile Error]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/family-profile
 * Create or update full family profile including members and travel preferences.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await req.json();
    const {
      familyName,
      homeLocation,
      federalState,
      originAirports,
      maxDrivingHours,
      preferredCabinClass,
      climatePreference,
      passportCheckRequired,
      members,
      blackoutRanges,
    } = body;

    if (!homeLocation || !federalState) {
      return NextResponse.json(
        { error: 'Home location and federal state are mandatory.' },
        { status: 400 }
      );
    }

    // Upsert FamilyProfile
    const profile = await prisma.familyProfile.upsert({
      where: { userId },
      update: {
        familyName: familyName || null,
        homeLocation,
        federalState,
        originAirports: originAirports || ['STR', 'FRA'],
        maxDrivingHours: maxDrivingHours !== undefined ? Number(maxDrivingHours) : 2.5,
        preferredCabinClass: preferredCabinClass || 'ECONOMY',
        climatePreference: climatePreference || 'MODERATE',
        passportCheckRequired: Boolean(passportCheckRequired),
        membersCount: Array.isArray(members) ? members.length : 1,
      },
      create: {
        userId,
        familyName: familyName || null,
        homeLocation,
        federalState,
        originAirports: originAirports || ['STR', 'FRA'],
        maxDrivingHours: maxDrivingHours !== undefined ? Number(maxDrivingHours) : 2.5,
        preferredCabinClass: preferredCabinClass || 'ECONOMY',
        climatePreference: climatePreference || 'MODERATE',
        passportCheckRequired: Boolean(passportCheckRequired),
        membersCount: Array.isArray(members) ? members.length : 1,
      },
    });

    // Replace members if provided
    if (Array.isArray(members)) {
      await prisma.familyMember.deleteMany({
        where: { familyProfileId: profile.id },
      });

      if (members.length > 0) {
        await prisma.familyMember.createMany({
          data: members.map((m: any) => ({
            familyProfileId: profile.id,
            firstName: m.firstName || null,
            role: m.role || 'MEMBER',
            birthDate: new Date(m.birthDate),
            schoolRequired: Boolean(m.schoolRequired),
            passportExpiry: m.passportExpiry ? new Date(m.passportExpiry) : null,
            specialDiet: m.specialDiet || null,
          })),
        });
      }
    }

    // Replace blackout ranges if provided
    if (Array.isArray(blackoutRanges)) {
      await prisma.blackoutDate.deleteMany({
        where: { familyProfileId: profile.id },
      });

      if (blackoutRanges.length > 0) {
        await prisma.blackoutDate.createMany({
          data: blackoutRanges.map((b: any) => ({
            familyProfileId: profile.id,
            startDate: new Date(b.startDate),
            endDate: new Date(b.endDate),
            reason: b.reason || null,
          })),
        });
      }
    }

    const updatedProfile = await prisma.familyProfile.findUnique({
      where: { id: profile.id },
      include: {
        members: { orderBy: { birthDate: 'asc' } },
        blackoutRanges: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Family profile saved successfully.',
      profile: updatedProfile,
    });
  } catch (error: any) {
    console.error('[POST /api/family-profile Error]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

