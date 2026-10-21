-- CreateEnum PeriodType
DO $$ BEGIN
    CREATE TYPE "PeriodType" AS ENUM ('STRICT_BLACKOUT', 'CHILDCARE_CLOSURE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AlterTable BlackoutPeriod: childcare closure arbitrage support
ALTER TABLE "BlackoutPeriod" ADD COLUMN IF NOT EXISTS "type" "PeriodType" NOT NULL DEFAULT 'STRICT_BLACKOUT';
ALTER TABLE "BlackoutPeriod" ADD COLUMN IF NOT EXISTS "coverageFactor" DOUBLE PRECISION NOT NULL DEFAULT 1.0;

-- AlterTable FamilyAirport: cached OSRM road routing metrics
ALTER TABLE "FamilyAirport" ADD COLUMN IF NOT EXISTS "drivingMinutes" INTEGER;
ALTER TABLE "FamilyAirport" ADD COLUMN IF NOT EXISTS "drivingKm" DOUBLE PRECISION;

-- CreateTable SharedTripBoard
CREATE TABLE IF NOT EXISTS "SharedTripBoard" (
    "id" TEXT NOT NULL,
    "shortCode" TEXT NOT NULL,
    "familyProfileId" TEXT,
    "searchParams" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SharedTripBoard_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SharedTripBoard_shortCode_key" ON "SharedTripBoard"("shortCode");
CREATE INDEX IF NOT EXISTS "SharedTripBoard_familyProfileId_idx" ON "SharedTripBoard"("familyProfileId");

-- CreateTable SharedCandidate
CREATE TABLE IF NOT EXISTS "SharedCandidate" (
    "id" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "destinationCode" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "snapshotData" JSONB NOT NULL,

    CONSTRAINT "SharedCandidate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SharedCandidate_boardId_idx" ON "SharedCandidate"("boardId");

DO $$ BEGIN
    ALTER TABLE "SharedCandidate" ADD CONSTRAINT "SharedCandidate_boardId_fkey"
        FOREIGN KEY ("boardId") REFERENCES "SharedTripBoard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateTable CandidateVote
CREATE TABLE IF NOT EXISTS "CandidateVote" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "voterName" TEXT NOT NULL,
    "vote" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CandidateVote_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CandidateVote_candidateId_voterName_key" ON "CandidateVote"("candidateId", "voterName");
CREATE INDEX IF NOT EXISTS "CandidateVote_candidateId_idx" ON "CandidateVote"("candidateId");

DO $$ BEGIN
    ALTER TABLE "CandidateVote" ADD CONSTRAINT "CandidateVote_candidateId_fkey"
        FOREIGN KEY ("candidateId") REFERENCES "SharedCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
