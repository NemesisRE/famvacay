-- CreateTable
CREATE TABLE "GeneratedDataset" (
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "payload" BYTEA,
    "payloadSha256" TEXT,
    "publishedAt" TIMESTAMP(3),
    "generatorState" BYTEA,
    "lastAttemptAt" TIMESTAMP(3),
    "lastError" TEXT,
    "nextDueAt" TIMESTAMP(3),
    "leaseOwner" TEXT,
    "leaseUntil" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeneratedDataset_pkey" PRIMARY KEY ("name")
);

