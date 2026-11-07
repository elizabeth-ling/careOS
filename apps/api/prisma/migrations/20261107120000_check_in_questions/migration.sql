-- Questions the caregiver asked in a check-in. Additive, so existing rows get an empty list.
ALTER TABLE "check_ins" ADD COLUMN "questions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
