import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/db/prisma';
import { resolveFamilyAirportRoadRouting } from '@/lib/geo/osrm';

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

    const adultMembers = profile.members.filter(
      (m: any) => m.role === 'PARENT' || m.role === 'MEMBER' || m.role === 'OTHER' || (m.role !== 'CHILD' && m.role !== 'INFANT')
    );
    const adultsCount = adultMembers.length > 0
      ? adultMembers.length
      : Math.max(1, profile.memberships.length);

    // Normalize legacy travel-mode values (FLIGHT, CAMPER) saved before the
    // shared TravelVehicle enum (PLANE|CAR|TRAIN|BUS) was adopted everywhere.
    const normalizedTravelModes = Array.isArray(profile.travelModes)
      ? [...new Set(profile.travelModes.map((m: string) => (m === 'FLIGHT' ? 'PLANE' : m === 'CAMPER' ? 'CAR' : m)))]
      : profile.travelModes;

    return NextResponse.json({
      profile: {
        ...profile,
        travelModes: normalizedTravelModes,
        adultsCount,
      },
    });
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
      maxTravelHours,
      preferredCabinClass,
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

    // Travel modes use the same TravelVehicle enum as the search form (PLANE|CAR|TRAIN|BUS).
    // Map legacy stored values (FLIGHT, CAMPER) for callers still sending the old names.
    const normalizeTravelMode = (m: string) => (m === 'FLIGHT' ? 'PLANE' : m === 'CAMPER' ? 'CAR' : m);
    const sanitizedTravelModes = Array.isArray(travelModes) && travelModes.length > 0
      ? [...new Set(travelModes.map(normalizeTravelMode))]
      : ['PLANE', 'CAR'];

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
      maxTravelHours: maxTravelHours !== undefined ? Number(maxTravelHours) : null,
      preferredCabinClass: preferredCabinClass || 'ECONOMY',
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

    // Sync FamilyAirport join rows for each preferred origin airport, then resolve (and cache)
    // real OSRM road-routing metrics in the background - never blocks the profile save response.
    if (Array.isArray(originAirports) && originAirports.length > 0) {
      const linkedAirports = await Promise.all(
        originAirports.map((iata: string) =>
          prisma.familyAirport
            .upsert({
              where: { familyProfileId_airportIata: { familyProfileId: profileId, airportIata: iata } },
              create: { familyProfileId: profileId, airportIata: iata },
              update: {},
            })
            .catch(() => null)
        )
      );

      void Promise.all(
        linkedAirports
          .filter(Boolean)
          .map((link: any) => resolveFamilyAirportRoadRouting(profileId, link.airportIata))
      ).catch(() => {});
    }

    // Replace members if provided
    if (Array.isArray(members)) {
      await prisma.familyMember.deleteMany({
        where: { familyProfileId: profileId },
      });

      // Names and adults' birth dates are optional: empty or unparseable dates are stored as null
      const optionalDate = (value: unknown) => {
        const date = typeof value === 'string' && value.trim() ? new Date(value) : null;
        return date && !Number.isNaN(date.getTime()) ? date : null;
      };
      if (members.length > 0) {
        await prisma.familyMember.createMany({
          data: members.map((m: any) => ({
            familyProfileId: profileId,
            displayName: m.displayName?.trim() || m.firstName?.trim() || null,
            firstName: m.firstName?.trim() || m.displayName?.trim() || null,
            role: m.role || 'MEMBER',
            birthDate: optionalDate(m.birthDate),
            schoolRequired: Boolean(m.schoolRequired),
            // Only a valid ISO 3166-2 code; empty means "follows the family's home region".
            schoolSubdivision:
              typeof m.schoolSubdivision === 'string' && /^[A-Z]{2}(-[A-Z0-9]{1,3})?$/i.test(m.schoolSubdivision.trim())
                ? m.schoolSubdivision.trim().toUpperCase()
                : null,
            passportExpiry: optionalDate(m.passportExpiry),
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
            type: b.type === 'CHILDCARE_CLOSURE' ? 'CHILDCARE_CLOSURE' : 'STRICT_BLACKOUT',
            coverageFactor: typeof b.coverageFactor === 'number' ? b.coverageFactor : 1.0,
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
