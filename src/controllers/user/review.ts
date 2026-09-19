import { Request, Response } from "express";
import prisma from "../../config/db";

/**
 * @Description Add a review for a companion after a completed booking
 * @Route POST /api/review
 * @Access Private
 */
export const addReview = async (req: Request, res: Response) => {
  const { id: clientId } = (req as any).user;
  const { companionId, rating, comment, tags } = req.body;

  if (!companionId || !rating || rating < 1 || rating > 5) {
    return res.status(400).json({ status: false, msg: "Valid companionId and rating (1-5) are required" });
  }

  try {
    const hasCompletedBooking = await prisma.booking.findFirst({
      where: {
        clientId,
        companionId,
        status: 'COMPLETED'
      }
    });

    if (!hasCompletedBooking) {
      return res.status(403).json({ status: false, msg: "You can only review companions you have had completed bookings with." });
    }

    //Existing Review 
    const existingReview = await prisma.review.findFirst({
      where: {
        clientId,
        companionId
      }
    });

    if (existingReview) {
      return res.status(400).json({ status: false, msg: "You have already reviewed this companion" });
    }

    // Create the review
    const newReview = await prisma.review.create({
      data: {
        clientId,
        companionId,
        rating,
        comment,
        tags: tags || []
      }
    });

    // Update the companion's average rating
    const allReviews = await prisma.review.findMany({
      where: { companionId }
    });

    const totalRating = allReviews.reduce((sum, rev) => sum + rev.rating, 0);
    const avgRating = totalRating / allReviews.length;

    await prisma.companionProfile.update({
      where: { id: companionId },
      data: { rating: avgRating }
    });

    return res.status(200).json({
      status: true,
      msg: "Review submitted successfully",
      data: newReview
    });
  } catch (error: any) {
    console.error('Error adding review:', error);
    res.status(500).json({ status: false, msg: 'Internal server error' });
  }
};
