import Joi from "joi";

const uuid = Joi.string().guid({ version: ["uuidv4"] });

export const propertyListQuerySchema = Joi.object({
  operationType: Joi.string().valid("sale", "rent", "temporary_rent"),
  propertyType: Joi.string().valid("house", "apartment", "commercial"),
  provinceId: uuid,
  cityId: uuid,
  currency: Joi.string().valid("ARS", "USD"),
  minPrice: Joi.number().min(0),
  maxPrice: Joi.number().min(0),
  sort: Joi.string().valid("newest", "price_asc", "price_desc").default("newest"),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(50).default(12),
})
  .oxor("provinceId", "cityId")
  .custom((value, helpers) => {
    if (value.minPrice !== undefined && value.maxPrice !== undefined && value.minPrice > value.maxPrice) {
      return helpers.error("price.range");
    }
    return value;
  });

export const propertyParamsSchema = Joi.object({ id: uuid.required() });
