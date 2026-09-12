/*
  Warnings:

  - A unique constraint covering the columns `[cloudflareId]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "cancellationReason" TEXT,
ADD COLUMN     "cancelledById" INTEGER,
ADD COLUMN     "paymentStatus" TEXT NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "stripePaymentIntentId" TEXT,
ADD COLUMN     "totalAmount" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "CompanionProfile" ADD COLUMN     "completedMeetups" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "jssScore" DOUBLE PRECISION DEFAULT 0.0,
ADD COLUMN     "reliabilityScore" DOUBLE PRECISION NOT NULL DEFAULT 100.0;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "about" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "activityType" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "age" INTEGER DEFAULT 0,
ADD COLUMN     "cloudflareId" TEXT,
ADD COLUMN     "currentToken" TEXT,
ADD COLUMN     "fcmToken" TEXT,
ADD COLUMN     "gallery" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "gender" TEXT DEFAULT '',
ADD COLUMN     "intros" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "languages" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "savedLocations" JSONB DEFAULT '[]',
ADD COLUMN     "walletBalance" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
ALTER COLUMN "profileImage" SET DEFAULT '';

-- CreateTable
CREATE TABLE "WalletTransaction" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedCompanion" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "companionId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedCompanion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Moment" (
    "id" SERIAL NOT NULL,
    "companionId" INTEGER NOT NULL,
    "mediaUrl" TEXT NOT NULL,
    "caption" TEXT,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "diamonds" INTEGER NOT NULL DEFAULT 0,
    "rings" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Moment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SavedCompanion_userId_companionId_key" ON "SavedCompanion"("userId", "companionId");

-- CreateIndex
CREATE UNIQUE INDEX "User_cloudflareId_key" ON "User"("cloudflareId");

-- AddForeignKey
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedCompanion" ADD CONSTRAINT "SavedCompanion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedCompanion" ADD CONSTRAINT "SavedCompanion_companionId_fkey" FOREIGN KEY ("companionId") REFERENCES "CompanionProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Moment" ADD CONSTRAINT "Moment_companionId_fkey" FOREIGN KEY ("companionId") REFERENCES "CompanionProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
