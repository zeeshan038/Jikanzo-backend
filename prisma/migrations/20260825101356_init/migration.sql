-- CreateEnum
CREATE TYPE "Role" AS ENUM ('CLIENT', 'COMPANION', 'BOTH');

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "profileImage" TEXT,
    "role" "Role" NOT NULL DEFAULT 'CLIENT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanionProfile" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "bio" TEXT,
    "hourlyRate" DOUBLE PRECISION,
    "locationLat" DOUBLE PRECISION,
    "locationLng" DOUBLE PRECISION,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "walletBalance" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "profileViews" INTEGER NOT NULL DEFAULT 0,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "trustRank" TEXT NOT NULL DEFAULT 'New',
    "totalSessions" INTEGER NOT NULL DEFAULT 0,
    "repeatClients" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CompanionProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" SERIAL NOT NULL,
    "clientId" INTEGER NOT NULL,
    "companionId" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" SERIAL NOT NULL,
    "clientId" INTEGER NOT NULL,
    "companionId" INTEGER NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Otp" (
    "id" SERIAL NOT NULL,
    "phone" TEXT NOT NULL,
    "otp" TEXT NOT NULL,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Otp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "CompanionProfile_userId_key" ON "CompanionProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Otp_phone_key" ON "Otp"("phone");

-- AddForeignKey
ALTER TABLE "CompanionProfile" ADD CONSTRAINT "CompanionProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_companionId_fkey" FOREIGN KEY ("companionId") REFERENCES "CompanionProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_companionId_fkey" FOREIGN KEY ("companionId") REFERENCES "CompanionProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
