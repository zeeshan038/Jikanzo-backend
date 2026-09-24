import prisma from '../config/db';
import { calculatePaymentBreakdown } from './bookingFinance';

export async function chargeBookingFromWallet(params: {
  clientUserId: number;
  companionUserId: number;
  bookingId: number;
  grossAmount: number;
  clientDescription: string;
  companionDescription: string;
}): Promise<{ breakdown: ReturnType<typeof calculatePaymentBreakdown> }> {
  const { clientUserId, companionUserId, bookingId, grossAmount, clientDescription, companionDescription } =
    params;

  if (grossAmount <= 0) {
    throw new Error('Invalid booking amount');
  }

  const breakdown = calculatePaymentBreakdown(grossAmount);

  const client = await prisma.user.findUnique({ where: { id: clientUserId } });
  if (!client || client.walletBalance < grossAmount) {
    throw new Error('INSUFFICIENT_BALANCE');
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: clientUserId },
      data: { walletBalance: { decrement: grossAmount } },
    });

    await tx.user.update({
      where: { id: companionUserId },
      data: { walletBalance: { increment: breakdown.companionNetAmount } },
    });

    await tx.walletTransaction.create({
      data: {
        userId: clientUserId,
        bookingId,
        amount: grossAmount,
        type: 'DEBIT',
        description: clientDescription,
      },
    });

    await tx.walletTransaction.create({
      data: {
        userId: companionUserId,
        bookingId,
        amount: breakdown.companionNetAmount,
        type: 'CREDIT',
        description: companionDescription,
      },
    });
  });

  return { breakdown };
}
