-- Adults' birth dates do not matter to the search (only children's ages do): optional, like names.
ALTER TABLE "FamilyMember" ALTER COLUMN "birthDate" DROP NOT NULL;
