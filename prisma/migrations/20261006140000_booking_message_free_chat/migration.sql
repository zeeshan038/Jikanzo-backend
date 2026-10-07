-- Free-form booking chat (text + images)
ALTER TABLE "BookingMessage" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;
ALTER TABLE "BookingMessage" ALTER COLUMN "messageId" DROP NOT NULL;
