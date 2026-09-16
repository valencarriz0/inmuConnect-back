import Joi from "joi";

const uuid = Joi.string().guid({ version: ["uuidv4"] });

export const cityListQuerySchema = Joi.object({ provinceId: uuid });

export const locationSearchQuerySchema = Joi.object({
  q: Joi.string().trim().min(2).max(100).required(),
});

export const geocodeBodySchema = Joi.object({
  cityId: uuid.required(),
  street: Joi.string().trim().min(2).max(150).required(),
  streetNumber: Joi.string().trim().max(30).empty("").default(null).allow(null),
});
