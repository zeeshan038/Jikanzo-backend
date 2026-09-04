import Joi from 'joi';

export const RegisterSchema = Joi.object({
  username: Joi.string().min(3).max(30).required(),
  phone: Joi.string().required(),
  role: Joi.string().valid('CLIENT', 'COMPANION', 'BOTH').required(),
});

export const SendOtpSchema = Joi.object({
  phone: Joi.string().required(),
});

export const VerifyOtpSchema = Joi.object({
  phone: Joi.string().required(),
  otp: Joi.string().length(6).required(),
});

export const LoginSchema = Joi.object({
  phone: Joi.string().required(),
  otp: Joi.string().length(6).required(),
});

export const UpdateProfileSchema = Joi.object({
  about: Joi.string().allow('', null).optional(),
  languages: Joi.array().items(Joi.string()).optional(),
  activityType: Joi.array().items(Joi.string()).optional(),
  savedLocations: Joi.array().items(Joi.object()).optional(),
  gender: Joi.string().allow('', null).optional(),
  age: Joi.number().integer().min(0).allow(null).optional(),
  username: Joi.string().min(3).max(30).optional(),
  profileImage: Joi.string().uri().allow('', null).optional(),
  gallery: Joi.array().items(Joi.string().uri().allow('', null)).optional(),
  intros: Joi.array().items(Joi.string().uri().allow('', null)).optional()
});
