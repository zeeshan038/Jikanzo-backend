import Joi from 'joi';

export const sendBookingMessageSchema = Joi.object({
  messageId: Joi.string().trim().required(),
  latitude: Joi.number().min(-90).max(90),
  longitude: Joi.number().min(-180).max(180),
}).and('latitude', 'longitude');
