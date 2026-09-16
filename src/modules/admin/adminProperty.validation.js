import Joi from "joi";
import { updatePublisherPropertySchema } from "../properties/publisherProperty.validation.js";

const uuid = Joi.string().guid({ version: ["uuidv4"] });

export const adminPropertyParamsSchema = Joi.object({ id: uuid.required() });

export const adminPropertyListSchema = Joi.object({
  status: Joi.string().valid("active", "paused", "deleted", "all").default("all"),
  publisherId: uuid,
  operationType: Joi.string().valid("sale", "rent", "temporary_rent"),
  q: Joi.string().trim().min(1).max(200),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

export const adminUpdatePropertySchema = updatePublisherPropertySchema.fork(
  ["images"],
  (schema) => schema.forbidden(),
);
