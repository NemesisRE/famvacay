import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/family-profile
 * Retrieve family profile for currently authenticated user via membership or legacy link.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const profile = await prisma.familyProfile.findFirst({
      where: {
        OR: [
          { userId },
          { memberships: { some: { userId } } },
        ],
      },
      include: {
        members: {
          orderBy: { birthDate: 'asc' },
        },
        blackoutPeriods: true,
        blackoutRanges: true,
        preferredAirports: {
          include: { airport: true },
        },
        memberships: {
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
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
 * Create or update full flat family profile including members and travel preferences.
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
      holidayCountry,
      holidaySubdivision,
      workweekDays,
      originAirports,
      maxDrivingHours,
      maxTravelHours,
      preferredCabinClass,
      climatePreference,
      passportCheckRequired,
      travelModes,
      scoringWeights,
      preferredPortals,
      locale,
      currency,
      members,
      blackoutRanges,
      blackoutPeriods,
    } = body;

    if (!homeLocation || !federalState) {
      return NextResponse.json(
        { error: 'Home location and federal state are mandatory.' },
        { status: 400 }
      );
    }

    // Default travel modes to ['FLIGHT', 'CAR'] if omitted
    const sanitizedTravelModes = Array.isArray(travelModes) && travelModes.length > 0
      ? travelModes
      : ['FLIGHT', 'CAR'];

    // Find existing profile for this user
    let existingProfile = await prisma.familyProfile.findFirst({
      where: {
        OR: [
          { userId },
          { memberships: { some: { userId } } },
        ],
      },
    });

    let profileId: string;

    const dataPayload = {
      familyName: familyName || null,
      homeLocation,
      federalState,
      holidayCountry: holidayCountry || 'DE',
      holidaySubdivision: holidaySubdivision || federalState,
      workweekDays: Array.isArray(workweekDays) && workweekDays.length > 0 ? workweekDays : [1, 2, 3, 4, 5],
      originAirports: Array.isArray(originAirports) ? originAirports : [],
      maxDrivingHours: maxDrivingHours !== undefined ? Number(maxDrivingHours) : 2.5,
      maxTravelHours: maxTravelHours !== undefined ? Number(maxTravelHours) : null,
      preferredCabinClass: preferredCabinClass || 'ECONOMY',
      climatePreference: climatePreference || 'MODERATE',
      passportCheckRequired: Boolean(passportCheckRequired),
      travelModes: sanitizedTravelModes,
      scoringWeights: scoringWeights || undefined,
      preferredPortals: Array.isArray(preferredPortals) ? preferredPortals : [],
      locale: locale || 'en',
      currency: currency || 'EUR',
      membersCount: Array.isArray(members) ? members.length : 1,
    };

    if (existingProfile) {
      profileId = existingProfile.id;
      await prisma.familyProfile.update({
        where: { id: profileId },
        data: dataPayload,
      });
    } else {
      const created = await prisma.familyProfile.create({
        data: {
          ...dataPayload,
          userId,
          memberships: {
            create: { userId },
          },
        },
      });
      profileId = created.id;
    }

    // Ensure user has a membership record for this profile
    await prisma.familyMembership.upsert({
      where: {
        userId_familyProfileId: { userId, familyProfileId: profileId },
      },
      create: { userId, familyProfileId: profileId },
      update: {},
    });

    // Replace members if provided
    if (Array.isArray(members)) {
      await prisma.familyMember.deleteMany({
        where: { familyProfileId: profileId },
      });

      if (members.length > 0) {
        await prisma.familyMember.createMany({
          data: members.map((m: any) => ({
            familyProfileId: profileId,
            displayName: m.displayName || m.firstName || null,
            firstName: m.firstName || m.displayName || null,
            role: m.role || 'MEMBER',
            birthDate: new Date(m.birthDate),
            schoolRequired: Boolean(m.schoolRequired),
            passportExpiry: m.passportExpiry ? new Date(m.passportExpiry) : null,
            specialDiet: m.specialDiet || null,
          })),
        });
      }
    }

    // Replace blackout ranges / periods if provided
    const incomingBlackouts = blackoutPeriods || blackoutRanges;
    if (Array.isArray(incomingBlackouts)) {
      await prisma.blackoutDate.deleteMany({
        where: { familyProfileId: profileId },
      });
      await prisma.blackoutPeriod.deleteMany({
        where: { familyProfileId: profileId },
      });

      if (incomingBlackouts.length > 0) {
        await prisma.blackoutPeriod.createMany({
          data: incomingBlackouts.map((b: any) => ({
            familyProfileId: profileId,
            startDate: new Date(b.startDate),
            endDate: new Date(b.endDate),
            recurrence: b.recurrence || 'NONE',
            reason: b.reason || null,
          })),
        });

        // Also keep legacy BlackoutDate table synchronized
        await prisma.blackoutDate.createMany({
          data: incomingBlackouts.map((b: any) => ({
            familyProfileId: profileId,
            startDate: new Date(b.startDate),
            endDate: new Date(b.endDate),
            reason: b.reason || null,
          })),
        });
      }
    }

    const updatedProfile = await prisma.familyProfile.findUnique({
      where: { id: profileId },
      include: {
        members: { orderBy: { birthDate: 'asc' } },
        blackoutPeriods: true,
        blackoutRanges: true,
        memberships: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
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
