-- AlterTable
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "extensionPrompt30SentAt" TIMESTAMP(3);
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "extensionPrompt15SentAt" TIMESTAMP(3);
