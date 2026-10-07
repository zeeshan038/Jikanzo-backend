import Joi from 'joi';

const MAX_TEXT_LEN = 4000;

export const sendBookingMessageSchema = Joi.object({
  text: Joi.string().trim().max(MAX_TEXT_LEN).allow(''),
  messageId: Joi.string().trim(),
  imageUrl: Joi.string().trim().max(2048),
  latitude: Joi.number().min(-90).max(90),
  longitude: Joi.number().min(-180).max(180),
})
  .and('latitude', 'longitude')
  .custom((value, helpers) => {
    const text = typeof value.text === 'string' ? value.text.trim() : '';
    const imageUrl = typeof value.imageUrl === 'string' ? value.imageUrl.trim() : '';
    const messageId = typeof value.messageId === 'string' ? value.messageId.trim() : '';
    const hasCoords = value.latitude != null && value.longitude != null;
    const hasText = text.length > 0;
    const hasImage = imageUrl.length > 0;
    const hasCatalogId = messageId.length > 0;

    if (hasCatalogId && (hasText || hasImage)) {
      return helpers.error('any.custom', {
        message: 'Send either a catalog messageId or free text/image, not both',
      });
    }

    if (hasCatalogId) {
      return { ...value, text, imageUrl, messageId };
    }

    if (!hasText && !hasImage && !hasCoords) {
      return helpers.error('any.custom', {
        message: 'Message must include text, imageUrl, or location coordinates',
      });
    }

    return { ...value, text, imageUrl, messageId: undefined };
  });
