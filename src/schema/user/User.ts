import Joi from 'joi';
import { MAX_SAVED_LOCATIONS } from '../../utils/savedLocations';

const SavedLocationSchema = Joi.object({
  lat: Joi.alternatives().try(Joi.number(), Joi.string()).required(),
  lng: Joi.alternatives().try(Joi.number(), Joi.string()).required(),
  name: Joi.string().allow('', null).optional(),
  isActive: Joi.boolean().optional(),
  isPrimary: Joi.boolean().optional(),
});

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

export const SetActiveLocationSchema = Joi.object({
  index: Joi.number().integer().min(0).optional(),
  lat: Joi.alternatives().try(Joi.number(), Joi.string()).optional(),
  lng: Joi.alternatives().try(Joi.number(), Joi.string()).optional(),
  name: Joi.string().allow('', null).optional(),
})
  .custom((value, helpers) => {
    const hasIndex = value.index !== undefined;
    const hasLat = value.lat !== undefined;
    const hasLng = value.lng !== undefined;

    if (hasIndex && (hasLat || hasLng)) {
      return helpers.error('any.custom', {
        message: 'Send either index or lat/lng, not both',
      });
    }
    if (!hasIndex && !(hasLat && hasLng)) {
      return helpers.error('any.custom', {
        message: 'Send index or both lat and lng',
      });
    }
    if ((hasLat && !hasLng) || (!hasLat && hasLng)) {
      return helpers.error('any.custom', {
        message: 'lat and lng must be sent together',
      });
    }
    return value;
  });

export const UpdateProfileSchema = Joi.object({
  about: Joi.string().allow('', null).optional(),
  languages: Joi.array().items(Joi.string()).optional(),
  activityType: Joi.array().items(Joi.string()).optional(),
  savedLocations: Joi.array()
    .items(SavedLocationSchema)
    .max(MAX_SAVED_LOCATIONS)
    .optional(),
  gender: Joi.string().allow('', null).optional(),
  age: Joi.number().integer().min(0).allow(null).optional(),
  username: Joi.string().min(3).max(30).optional(),
  profileImage: Joi.string().uri().allow('', null).optional(),
  gallery: Joi.array().items(Joi.string().uri().allow('', null)).optional(),
  intros: Joi.array().items(Joi.string().uri().allow('', null)).optional(),
  serviceRadius: Joi.number().integer().min(0).allow(null).optional(),
  galleryLayout: Joi.alternatives()
    .try(Joi.string().valid('1', '2', '3'), Joi.number().valid(1, 2, 3))
    .optional(),
  companionProfileImage: Joi.string().uri().allow('', null).optional(),
  companionGallery: Joi.array().items(Joi.string().uri().allow('', null)).optional(),
  companionGalleryLayout: Joi.alternatives()
    .try(Joi.string().valid('1', '2', '3'), Joi.number().valid(1, 2, 3))
    .optional(),
});

export const UploadGallerySchema = Joi.object({
  galleryLayout: Joi.alternatives()
    .try(Joi.string().valid('1', '2', '3'), Joi.number().valid(1, 2, 3))
    .required(),
  images: Joi.array().items(Joi.string().uri()).min(1).required(),
  isCompanion: Joi.boolean().optional().default(false),
});

export function normalizeGalleryLayout(value: string | number): '1' | '2' | '3' {
  const s = String(value);
  if (s === '1' || s === '2' || s === '3') return s;
  throw new Error('galleryLayout must be 1, 2, or 3');
}

export const DeleteMediaSchema = Joi.object({
  url: Joi.string().uri().required(),
  scope: Joi.string()
    .valid('auto', 'gallery', 'profile', 'intro')
    .default('auto'),
  isCompanion: Joi.boolean().optional().default(false),
});
