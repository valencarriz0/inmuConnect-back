import Joi from "joi";
import { normalizeEmail } from "../../utils/email.js";

const uuid = Joi.string().guid({ version: ["uuidv4"] });

export const consultationParamsSchema = Joi.object({ id: uuid.required() });

export const createConsultationSchema = Joi.object({
  firstName: Joi.string().trim().min(2).max(100).required(),
  lastName: Joi.string().trim().min(2).max(100).required(),
  email: Joi.string().trim().custom(normalizeEmail).email({ tlds: { allow: false } }).max(254).required(),
  phone: Joi.string().trim().min(1).max(50).required(),
  message: Joi.string().trim().min(1).max(5000).allow(null),
});

export const publisherConsultationQuerySchema = Joi.object({ propertyId: uuid });
