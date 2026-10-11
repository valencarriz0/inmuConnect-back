import Joi from "joi";

export const publisherMetricQuerySchema = Joi.object({
  period: Joi.number().integer().valid(7, 30, 90),
});
