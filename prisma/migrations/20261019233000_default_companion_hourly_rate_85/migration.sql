-- Default starting hourly rate $85 for companions who never set pricing
UPDATE "CompanionProfile"
SET "hourlyRate" = 85
WHERE "hourlyRate" IS NULL OR "hourlyRate" <= 0;

ALTER TABLE "CompanionProfile"
ALTER COLUMN "hourlyRate" SET DEFAULT 85;
