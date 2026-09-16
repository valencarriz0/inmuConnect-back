import Joi from "joi";

const uuid = Joi.string().guid({ version: ["uuidv4"] });
const nullableText = (maximum) => Joi.any().custom((value, helpers) => {
  if (value === null) return null;
  if (typeof value !== "string") return helpers.error("string.base");
  const normalized = value.trim();
  if (normalized.length > maximum) return helpers.error("string.max", { limit: maximum });
  return normalized || null;
});
const nullableInteger = Joi.number().integer().min(0).max(32767).allow(null);
const nullableMoney = Joi.number().min(0).precision(2).allow(null);
const code = Joi.string().trim().min(1).max(100);
const imageUrl = Joi.string().trim().uri({ scheme: ["http", "https"] }).max(2048);

const editableFields = {
  title: Joi.string().trim().min(1).max(200),
  description: Joi.string().trim().min(1).max(5000),
  operationType: Joi.string().valid("sale", "rent", "temporary_rent"),
  propertyType: Joi.string().valid("house", "apartment", "commercial"),
  price: Joi.number().positive().precision(2),
  currency: Joi.string().valid("ARS", "USD"),
  cityId: uuid,
  street: nullableText(150),
  streetNumber: nullableText(30),
  totalArea: Joi.number().positive().precision(2),
  rooms: Joi.number().integer().min(1).max(32767),
  bedrooms: nullableInteger,
  bathrooms: nullableInteger,
  age: nullableInteger,
  propertyCondition: Joi.string().valid("new", "excellent", "good", "to-renovate").allow(null),
  acceptsPets: Joi.boolean().allow(null),
  garage: nullableInteger,
  expenses: nullableMoney,
  taxes: nullableMoney,
  commissions: nullableMoney,
  latitude: Joi.number().min(-90).max(90).allow(null),
  longitude: Joi.number().min(-180).max(180).allow(null),
  serviceCodes: Joi.array().items(code).unique(),
  amenityCodes: Joi.array().items(code).unique(),
  images: Joi.array().items(imageUrl).min(2).max(5),
};

export const publisherPropertyParamsSchema = Joi.object({ id: uuid.required() });

export const publisherPropertyListQuerySchema = Joi.object({
  status: Joi.string().valid("active", "paused", "all").default("all"),
});

export const createPublisherPropertySchema = Joi.object({
  ...editableFields,
  title: editableFields.title.required(),
  description: editableFields.description.required(),
  operationType: editableFields.operationType.required(),
  propertyType: editableFields.propertyType.required(),
  price: editableFields.price.required(),
  currency: editableFields.currency.required(),
  cityId: editableFields.cityId.required(),
  totalArea: editableFields.totalArea.required(),
  rooms: editableFields.rooms.required(),
  images: editableFields.images.required(),
  serviceCodes: editableFields.serviceCodes.default([]),
  amenityCodes: editableFields.amenityCodes.default([]),
}).and("latitude", "longitude");

export const updatePublisherPropertySchema = Joi.object(editableFields)
  .and("latitude", "longitude")
  .min(1);
