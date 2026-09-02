import Joi from 'joi';

export const addMoneySchema = Joi.object({
  amount: Joi.number().greater(0).required(),
});

export const payWithWalletSchema = Joi.object({
  bookingId: Joi.number().required(),
});
