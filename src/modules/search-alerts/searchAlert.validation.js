import Joi from "joi";

const uuid = Joi.string().guid({ version: ["uuidv4"] });
const optionalText = Joi.string().trim().max(120).allow(null, "").custom((value) => value || null);
const criteria = {
  name: optionalText,
  operationType: Joi.string().valid("sale", "rent", "temporary_rent").allow(null),
  propertyType: Joi.string().valid("house", "apartment", "commercial").allow(null),
  provinceId: uuid.allow(null),
  cityId: uuid.allow(null),
  currency: Joi.string().valid("ARS", "USD").allow(null),
  minPrice: Joi.number().min(0).precision(2).allow(null),
  maxPrice: Joi.number().min(0).precision(2).allow(null),
};

const pricing = Joi.object(criteria).custom((value, helpers) => {
  if ((value.minPrice !== null || value.maxPrice !== null) && !value.currency) return helpers.error("any.invalid");
  if (value.minPrice !== null && value.maxPrice !== null && value.minPrice > value.maxPrice) return helpers.error("any.invalid");
  if (!Object.values(value).some((item) => item !== null && item !== undefined)) return helpers.error("any.invalid");
  return value;
}).messages({ "any.invalid": "Los criterios de alerta no son válidos." });

export const createSearchAlertSchema = pricing.required();
export const updateSearchAlertSchema = pricing.min(1).required();
export const searchAlertParamsSchema = Joi.object({ id: uuid.required() });
