-- Sign out all sessions of a user (e.g. when an unconfirmed account is taken over by its real owner)
ALTER TABLE "User" ADD COLUMN     "sessionVersion" INTEGER NOT NULL DEFAULT 0;

-- Passport reminders already mailed per family member ("<expiry date>:<stage>")
ALTER TABLE "FamilyMember" ADD COLUMN     "passportRemindersSent" TEXT[] DEFAULT ARRAY[]::TEXT[];
