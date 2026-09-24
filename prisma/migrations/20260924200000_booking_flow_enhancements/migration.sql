-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "cancellationReasonCode" TEXT,
ADD COLUMN     "companionNetAmount" DOUBLE PRECISION,
ADD COLUMN     "extensionPaymentStatus" TEXT NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "grossAmount" DOUBLE PRECISION,
ADD COLUMN     "otpVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "platformFee" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "WalletTransaction" ADD COLUMN     "bookingId" INTEGER;
