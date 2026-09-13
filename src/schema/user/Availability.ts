import Joi from 'joi';

export const WeeklyScheduleSchema = Joi.array().items(
    Joi.object({
        dayOfWeek: Joi.number().integer().min(0).max(6).required(),
        isAvailable: Joi.boolean().required(),
        startTime: Joi.string().allow(null, '').optional(),
        endTime: Joi.string().allow(null, '').optional()
    })
).length(7);

export const AvailabilitySettingsSchema = Joi.object({
    bookingBufferMin: Joi.number().valid(30, 60, 90, 120).optional(),
    isPaused: Joi.boolean().optional()
});

export const OneTimeAvailabilitySchema = Joi.object({
    date: Joi.date().iso().required(),
    startTime: Joi.string().required(),
    endTime: Joi.string().required(),
    location: Joi.string().allow(null, '').optional()
});

export const BlockedDateSchema = Joi.object({
    startDate: Joi.date().iso().required(),
    endDate: Joi.date().iso().required(),
    reason: Joi.string().allow(null, '').optional()
});
