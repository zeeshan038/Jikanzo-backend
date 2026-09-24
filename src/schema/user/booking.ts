import Joi from 'joi';

export const createBooking = Joi.object({
  date: Joi.date().iso().required(),
  startTime: Joi.date().iso().required(),
  endTime: Joi.date().iso().required(),
  latitude: Joi.number().optional(),
  longitude: Joi.number().optional(),
  address: Joi.string().optional(),
  activity: Joi.string().optional(),
});

export const acceptBooking = Joi.object({
  bookingId: Joi.number().required(),
  action: Joi.string().valid('ACCEPT', 'DECLINE').required(),
});

export const cancelBookingSchema = Joi.object({
  reasonCode: Joi.string().required(),
  reasonText: Joi.string().max(500).optional().allow(''),
});

export const rescheduleBookingSchema = Joi.object({
  date: Joi.date().iso().required(),
  startTime: Joi.date().iso().required(),
  endTime: Joi.date().iso().required(),
  latitude: Joi.number().optional(),
  longitude: Joi.number().optional(),
  address: Joi.string().optional(),
  activity: Joi.string().optional(),
});

export const verifyBookingOtpSchema = Joi.object({
  otp: Joi.string().length(4).required(),
});
