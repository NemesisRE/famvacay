-- DropForeignKey
ALTER TABLE "BlackoutDate" DROP CONSTRAINT IF EXISTS "BlackoutDate_userProfileId_fkey";
ALTER TABLE "TripPlan" DROP CONSTRAINT IF EXISTS "TripPlan_userProfileId_fkey";

-- DropTable
DROP TABLE IF EXISTS "UserProfile" CASCADE;

-- CreateTable User
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" TIMESTAMP(3),
    "passwordHash" TEXT,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable Account
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable Session
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable VerificationToken
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable Authenticator (Passkeys / WebAuthn)
CREATE TABLE "Authenticator" (
    "credentialID" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "credentialPublicKey" TEXT NOT NULL,
    "counter" BIGINT NOT NULL,
    "credentialDeviceType" TEXT NOT NULL,
    "credentialBackedUp" BOOLEAN NOT NULL,
    "transports" TEXT,

    CONSTRAINT "Authenticator_pkey" PRIMARY KEY ("credentialID")
);

-- CreateTable FamilyProfile
CREATE TABLE "FamilyProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "familyName" TEXT,
    "homeLocation" TEXT NOT NULL,
    "federalState" TEXT NOT NULL,
    "originAirports" TEXT[],
    "maxDrivingHours" DOUBLE PRECISION DEFAULT 2.5,
    "preferredCabinClass" TEXT DEFAULT 'ECONOMY',
    "climatePreference" TEXT DEFAULT 'MODERATE',
    "passportCheckRequired" BOOLEAN NOT NULL DEFAULT false,
    "membersCount" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FamilyProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable FamilyMember
CREATE TABLE "FamilyMember" (
    "id" TEXT NOT NULL,
    "familyProfileId" TEXT NOT NULL,
    "firstName" TEXT,
    "role" TEXT NOT NULL,
    "birthDate" TIMESTAMP(3) NOT NULL,
    "schoolRequired" BOOLEAN NOT NULL DEFAULT false,
    "passportExpiry" TIMESTAMP(3),
    "specialDiet" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FamilyMember_pkey" PRIMARY KEY ("id")
);

-- Update BlackoutDate
ALTER TABLE "BlackoutDate" DROP COLUMN IF EXISTS "userProfileId";
ALTER TABLE "BlackoutDate" ADD COLUMN IF NOT EXISTS "familyProfileId" TEXT NOT NULL;

-- Update TripPlan
ALTER TABLE "TripPlan" DROP COLUMN IF EXISTS "userProfileId";
ALTER TABLE "TripPlan" ADD COLUMN IF NOT EXISTS "familyProfileId" TEXT NOT NULL;

-- CreateIndexes
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");
CREATE UNIQUE INDEX "Authenticator_userId_credentialID_key" ON "Authenticator"("userId", "credentialID");
CREATE UNIQUE INDEX "FamilyProfile_userId_key" ON "FamilyProfile"("userId");

-- AddForeignKeys
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Authenticator" ADD CONSTRAINT "Authenticator_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FamilyProfile" ADD CONSTRAINT "FamilyProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FamilyMember" ADD CONSTRAINT "FamilyMember_familyProfileId_fkey" FOREIGN KEY ("familyProfileId") REFERENCES "FamilyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BlackoutDate" ADD CONSTRAINT "BlackoutDate_familyProfileId_fkey" FOREIGN KEY ("familyProfileId") REFERENCES "FamilyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TripPlan" ADD CONSTRAINT "TripPlan_familyProfileId_fkey" FOREIGN KEY ("familyProfileId") REFERENCES "FamilyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

