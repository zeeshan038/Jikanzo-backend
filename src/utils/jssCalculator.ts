import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Configurable weights and thresholds
const JSS_CONFIG = {
  WEIGHTS: {
    CUSTOMER_SATISFACTION: 0.45,
    MEETUP_COMPLETION: 0.30,
    REPEAT_CLIENT: 0.15,
    RELIABILITY: 0.10,
  },
  THRESHOLDS: {
    REPEAT_CLIENT_TARGET_RATE: 0.30, // 30% repeat rate gets full 100 points
  },
};

/**
 * Calculates the Jikanzo Success Score (JSS) for a companion.
 * JSS = (Customer Satisfaction × 45%) + (Meetup Completion × 30%) +
 *       (Repeat Client Score × 15%) + (Reliability × 10%)
 */
export const calculateJSS = async (companionProfileId: number): Promise<number> => {
  const profile = await prisma.companionProfile.findUnique({
    where: { id: companionProfileId },
    include: {
      user: true,
      reviews: true,
      bookings: true,
    },
  });

  if (!profile) {
    throw new Error(`Companion Profile not found: ${companionProfileId}`);
  }

  // 1. Customer Satisfaction (45%)
  let customerSatisfactionScore = 0;
  if (profile.reviews && profile.reviews.length > 0) {
    const totalRating = profile.reviews.reduce((sum, review) => sum + review.rating, 0);
    const averageRating = totalRating / profile.reviews.length;
    customerSatisfactionScore = (averageRating / 5) * 100;
  }

  // 2. Meetup Completion (30%)
  let meetupCompletionScore = 0;
  let completedMeetups = 0;
  let companionResponsibleCancellations = 0;

  const relevantBookings = profile.bookings.filter(b => 
    b.status === "COMPLETED" || 
    (b.status === "CANCELLED" && b.cancelledById === profile.userId)
  );

  const companionAcceptedBookingsCount = relevantBookings.length;

  if (companionAcceptedBookingsCount > 0) {
    completedMeetups = relevantBookings.filter(b => b.status === "COMPLETED").length;
    meetupCompletionScore = (completedMeetups / companionAcceptedBookingsCount) * 100;
  }

  // 3. Repeat Client Score (15%)
  let repeatClientScore = 0;
  
  if (completedMeetups === 0) {
    // Early-Stage Protection: Treat as neutral (100) if no opportunity yet
    repeatClientScore = 100;
  } else {
    // Find unique clients from completed bookings
    const completedBookingClients = profile.bookings
      .filter(b => b.status === "COMPLETED")
      .map(b => b.clientId);
    
    // Count occurrences of each client
    const clientCounts: Record<number, number> = {};
    completedBookingClients.forEach(clientId => {
      clientCounts[clientId] = (clientCounts[clientId] || 0) + 1;
    });

    const totalUniqueClients = Object.keys(clientCounts).length;
    const repeatClients = Object.values(clientCounts).filter(count => count > 1).length;

    if (totalUniqueClients === 0) {
       repeatClientScore = 100;
    } else {
       const repeatRate = repeatClients / totalUniqueClients;
       // Normalize against the target rate (30%)
       repeatClientScore = Math.min((repeatRate / JSS_CONFIG.THRESHOLDS.REPEAT_CLIENT_TARGET_RATE) * 100, 100);
    }
  }

  // 4. Reliability (10%)
  // Pulls directly from profile which is decremented by separate cancellation flows
  const reliabilityScore = profile.reliabilityScore ?? 100.0;

  // Final JSS Calculation
  const finalJss = 
    (customerSatisfactionScore * JSS_CONFIG.WEIGHTS.CUSTOMER_SATISFACTION) +
    (meetupCompletionScore * JSS_CONFIG.WEIGHTS.MEETUP_COMPLETION) +
    (repeatClientScore * JSS_CONFIG.WEIGHTS.REPEAT_CLIENT) +
    (reliabilityScore * JSS_CONFIG.WEIGHTS.RELIABILITY);

  // Update profile with new cached score and completed count
  await prisma.companionProfile.update({
    where: { id: companionProfileId },
    data: {
      jssScore: finalJss,
      completedMeetups: completedMeetups,
    },
  });

  return finalJss;
};
