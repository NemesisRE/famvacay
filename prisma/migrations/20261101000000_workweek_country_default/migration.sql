-- Own workdays are optional: empty means the usual week of the home country (Monday-Friday,
-- Sunday-Thursday, ...), resolved per search so it follows a change of country
ALTER TABLE "FamilyProfile" ALTER COLUMN "workweekDays" SET DEFAULT ARRAY[]::INTEGER[];

-- No screen ever set workdays before: every stored Monday-Friday is the old column default,
-- not a choice, and would pin families outside Saturday/Sunday countries to the wrong week
UPDATE "FamilyProfile" SET "workweekDays" = ARRAY[]::INTEGER[] WHERE "workweekDays" = ARRAY[1, 2, 3, 4, 5];
