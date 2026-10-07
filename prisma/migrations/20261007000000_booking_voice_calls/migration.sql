-- AlterTable
ALTER TABLE "Booking" ADD COLUMN "coordinationOpenNotifiedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "BookingCall" (
    "id" TEXT NOT NULL,
    "bookingId" INTEGER NOT NULL,
    "callerUserId" INTEGER NOT NULL,
    "receiverUserId" INTEGER NOT NULL,
    "roomName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RINGING',
    "startedAt" TIMESTAMP(3),
    "answeredAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "duration" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookingCall_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BookingCall_roomName_key" ON "BookingCall"("roomName");

-- CreateIndex
CREATE INDEX "BookingCall_bookingId_createdAt_idx" ON "BookingCall"("bookingId", "createdAt");

-- CreateIndex
CREATE INDEX "BookingCall_bookingId_status_idx" ON "BookingCall"("bookingId", "status");

-- AddForeignKey
ALTER TABLE "BookingCall" ADD CONSTRAINT "BookingCall_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingCall" ADD CONSTRAINT "BookingCall_callerUserId_fkey" FOREIGN KEY ("callerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingCall" ADD CONSTRAINT "BookingCall_receiverUserId_fkey" FOREIGN KEY ("receiverUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
