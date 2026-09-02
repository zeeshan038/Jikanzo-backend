import Joi from 'joi';

export const createBooking = Joi.object({
  date: Joi.date().iso().required(),
  startTime: Joi.date().iso().required(),
  endTime: Joi.date().iso().required(),
});

export const acceptBooking = Joi.object({
  bookingId: Joi.number().required(),
  action: Joi.string().valid('ACCEPT', 'DECLINE').required(),
});
