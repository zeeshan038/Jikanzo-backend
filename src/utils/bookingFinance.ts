export const getPlatformFeePercent = (): number => {
  const raw = process.env.PLATFORM_FEE_PERCENT;
  const parsed = raw ? Number(raw) : 10;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 10;
};

export type PaymentBreakdown = {
  grossAmount: number;
  platformFee: number;
  companionNetAmount: number;
  platformFeePercent: number;
};

export const calculatePaymentBreakdown = (grossAmount: number): PaymentBreakdown => {
  const platformFeePercent = getPlatformFeePercent();
  const platformFee = Math.round(grossAmount * (platformFeePercent / 100) * 100) / 100;
  const companionNetAmount = Math.round((grossAmount - platformFee) * 100) / 100;
  return {
    grossAmount,
    platformFee,
    companionNetAmount,
    platformFeePercent,
  };
};

export const getStoredOrComputedBreakdown = (booking: {
  totalAmount: number | null;
  grossAmount: number | null;
  platformFee: number | null;
  companionNetAmount: number | null;
}): PaymentBreakdown => {
  if (
    booking.grossAmount != null &&
    booking.platformFee != null &&
    booking.companionNetAmount != null
  ) {
    return {
      grossAmount: booking.grossAmount,
      platformFee: booking.platformFee,
      companionNetAmount: booking.companionNetAmount,
      platformFeePercent: getPlatformFeePercent(),
    };
  }
  const gross = booking.totalAmount ?? 0;
  return calculatePaymentBreakdown(gross);
};
