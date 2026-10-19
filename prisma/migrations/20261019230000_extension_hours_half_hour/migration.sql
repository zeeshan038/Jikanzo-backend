-- Allow half-hour extensions (e.g. 0.5 = 30 minutes) on booking.extensionHours
ALTER TABLE "Booking" ALTER COLUMN "extensionHours" SET DATA TYPE DOUBLE PRECISION;
