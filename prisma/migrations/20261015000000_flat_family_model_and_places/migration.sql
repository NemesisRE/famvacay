-- AlterTable FamilyProfile to support flat shared model & extended travel preferences
ALTER TABLE "FamilyProfile" ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "FamilyProfile" ADD COLUMN IF NOT EXISTS "homeLat" DOUBLE PRECISION;
ALTER TABLE "FamilyProfile" ADD COLUMN IF NOT EXISTS "homeLon" DOUBLE PRECISION;
ALTER TABLE "FamilyProfile" ADD COLUMN IF NOT EXISTS "homePlaceId" TEXT;
ALTER TABLE "FamilyProfile" ADD COLUMN IF NOT EXISTS "holidayCountry" TEXT DEFAULT 'DE';
ALTER TABLE "FamilyProfile" ADD COLUMN IF NOT EXISTS "holidaySubdivision" TEXT;
ALTER TABLE "FamilyProfile" ADD COLUMN IF NOT EXISTS "workweekDays" INTEGER[] DEFAULT ARRAY[1, 2, 3, 4, 5]::INTEGER[];
ALTER TABLE "FamilyProfile" ADD COLUMN IF NOT EXISTS "maxTravelHours" DOUBLE PRECISION;
ALTER TABLE "FamilyProfile" ADD COLUMN IF NOT EXISTS "directFlightsOnly" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "FamilyProfile" ADD COLUMN IF NOT EXISTS "scoringWeights" JSONB;
ALTER TABLE "FamilyProfile" ADD COLUMN IF NOT EXISTS "preferredPortals" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "FamilyProfile" ADD COLUMN IF NOT EXISTS "locale" TEXT NOT NULL DEFAULT 'en';
ALTER TABLE "FamilyProfile" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'EUR';

-- AlterTable FamilyMember
ALTER TABLE "FamilyMember" ADD COLUMN IF NOT EXISTS "displayName" TEXT;
ALTER TABLE "FamilyMember" ALTER COLUMN "birthDate" SET DATA TYPE DATE;
ALTER TABLE "FamilyMember" ALTER COLUMN "passportExpiry" SET DATA TYPE DATE;

-- CreateTable FamilyMembership
CREATE TABLE IF NOT EXISTS "FamilyMembership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "familyProfileId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FamilyMembership_pkey" PRIMARY KEY ("id")
);

-- Backfill FamilyMembership for any existing FamilyProfile records
INSERT INTO "FamilyMembership" ("id", "userId", "familyProfileId", "createdAt")
SELECT gen_random_uuid()::text, "userId", "id", CURRENT_TIMESTAMP
FROM "FamilyProfile"
WHERE "userId" IS NOT NULL
ON CONFLICT DO NOTHING;

-- CreateTable FamilyInvite
CREATE TABLE IF NOT EXISTS "FamilyInvite" (
    "id" TEXT NOT NULL,
    "familyProfileId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FamilyInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable Place
CREATE TABLE IF NOT EXISTS "Place" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerId" TEXT,
    "displayName" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lon" DOUBLE PRECISION NOT NULL,
    "countryCode" TEXT,
    "subdivisionCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Place_pkey" PRIMARY KEY ("id")
);

-- CreateTable Airport
CREATE TABLE IF NOT EXISTS "Airport" (
    "iata" TEXT NOT NULL,
    "icao" TEXT,
    "name" TEXT NOT NULL,
    "municipality" TEXT,
    "country" TEXT NOT NULL,
    "subdivision" TEXT,
    "lat" DOUBLE PRECISION NOT NULL,
    "lon" DOUBLE PRECISION NOT NULL,
    "type" TEXT NOT NULL,
    "scheduledService" BOOLEAN NOT NULL DEFAULT true,
    "highSpeedRailConnected" BOOLEAN,
    "sourceUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Airport_pkey" PRIMARY KEY ("iata")
);

-- CreateTable FamilyAirport
CREATE TABLE IF NOT EXISTS "FamilyAirport" (
    "id" TEXT NOT NULL,
    "familyProfileId" TEXT NOT NULL,
    "airportIata" TEXT NOT NULL,

    CONSTRAINT "FamilyAirport_pkey" PRIMARY KEY ("id")
);

-- CreateTable BlackoutPeriod
CREATE TABLE IF NOT EXISTS "BlackoutPeriod" (
    "id" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "recurrence" TEXT NOT NULL DEFAULT 'NONE',
    "reason" TEXT,
    "familyProfileId" TEXT NOT NULL,

    CONSTRAINT "BlackoutPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable TripSearch
CREATE TABLE IF NOT EXISTS "TripSearch" (
    "id" TEXT NOT NULL,
    "familyProfileId" TEXT NOT NULL,
    "durationMin" INTEGER NOT NULL,
    "durationMax" INTEGER NOT NULL,
    "earliestDate" DATE NOT NULL,
    "latestDate" DATE NOT NULL,
    "maxBudget" DECIMAL(10,2),
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "selectedAirports" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TripSearch_pkey" PRIMARY KEY ("id")
);

-- CreateTable _PlaceToTripSearch
CREATE TABLE IF NOT EXISTS "_PlaceToTripSearch" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndexes
CREATE UNIQUE INDEX IF NOT EXISTS "FamilyMembership_userId_familyProfileId_key" ON "FamilyMembership"("userId", "familyProfileId");
CREATE INDEX IF NOT EXISTS "FamilyMembership_userId_idx" ON "FamilyMembership"("userId");
CREATE INDEX IF NOT EXISTS "FamilyMembership_familyProfileId_idx" ON "FamilyMembership"("familyProfileId");

CREATE UNIQUE INDEX IF NOT EXISTS "FamilyInvite_tokenHash_key" ON "FamilyInvite"("tokenHash");
CREATE INDEX IF NOT EXISTS "FamilyInvite_familyProfileId_idx" ON "FamilyInvite"("familyProfileId");

CREATE INDEX IF NOT EXISTS "FamilyMember_familyProfileId_idx" ON "FamilyMember"("familyProfileId");

CREATE INDEX IF NOT EXISTS "Place_countryCode_idx" ON "Place"("countryCode");
CREATE INDEX IF NOT EXISTS "Place_category_idx" ON "Place"("category");

CREATE INDEX IF NOT EXISTS "Airport_country_idx" ON "Airport"("country");

CREATE UNIQUE INDEX IF NOT EXISTS "FamilyAirport_familyProfileId_airportIata_key" ON "FamilyAirport"("familyProfileId", "airportIata");
CREATE INDEX IF NOT EXISTS "FamilyAirport_familyProfileId_idx" ON "FamilyAirport"("familyProfileId");
CREATE INDEX IF NOT EXISTS "FamilyAirport_airportIata_idx" ON "FamilyAirport"("airportIata");

CREATE INDEX IF NOT EXISTS "BlackoutPeriod_familyProfileId_idx" ON "BlackoutPeriod"("familyProfileId");
CREATE INDEX IF NOT EXISTS "TripSearch_familyProfileId_idx" ON "TripSearch"("familyProfileId");

CREATE UNIQUE INDEX IF NOT EXISTS "_PlaceToTripSearch_AB_unique" ON "_PlaceToTripSearch"("A", "B");
CREATE INDEX IF NOT EXISTS "_PlaceToTripSearch_B_index" ON "_PlaceToTripSearch"("B");

-- AddForeignKeys
ALTER TABLE "FamilyMembership" ADD CONSTRAINT "FamilyMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FamilyMembership" ADD CONSTRAINT "FamilyMembership_familyProfileId_fkey" FOREIGN KEY ("familyProfileId") REFERENCES "FamilyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FamilyInvite" ADD CONSTRAINT "FamilyInvite_familyProfileId_fkey" FOREIGN KEY ("familyProfileId") REFERENCES "FamilyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FamilyAirport" ADD CONSTRAINT "FamilyAirport_familyProfileId_fkey" FOREIGN KEY ("familyProfileId") REFERENCES "FamilyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FamilyAirport" ADD CONSTRAINT "FamilyAirport_airportIata_fkey" FOREIGN KEY ("airportIata") REFERENCES "Airport"("iata") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BlackoutPeriod" ADD CONSTRAINT "BlackoutPeriod_familyProfileId_fkey" FOREIGN KEY ("familyProfileId") REFERENCES "FamilyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TripSearch" ADD CONSTRAINT "TripSearch_familyProfileId_fkey" FOREIGN KEY ("familyProfileId") REFERENCES "FamilyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "_PlaceToTripSearch" ADD CONSTRAINT "_PlaceToTripSearch_A_fkey" FOREIGN KEY ("A") REFERENCES "Place"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_PlaceToTripSearch" ADD CONSTRAINT "_PlaceToTripSearch_B_fkey" FOREIGN KEY ("B") REFERENCES "TripSearch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
