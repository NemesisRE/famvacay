-- Remove specialDiet (Art. 9 GDPR special category data) from FamilyMember.
-- The field was never exposed in the UI; dropped entirely per legal/privacy audit.
ALTER TABLE "FamilyMember" DROP COLUMN "specialDiet";
