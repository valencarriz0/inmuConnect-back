import Joi from "joi";
import { registerSchema } from "../auth/auth.validation.js";
import { phoneSchema } from "../users/user.validation.js";

const publisherType = Joi.string().valid("individual", "agency").required();
const taxId = Joi.string().trim().custom((value, helpers) => {
  if (!/^\d{11}$|^\d{2}-\d{8}-\d$/.test(value)) return helpers.error("any.invalid");
  return value.replaceAll("-", "");
}).required();
const agencyName = Joi.when("publisherType", {
  is: "agency",
  then: Joi.string().trim().min(1).required(),
  otherwise: Joi.string().trim().empty("").allow(null).default(null),
});

export const applicationSchema = Joi.object({
  publisherType,
  taxId,
  agencyName,
  phone: phoneSchema.invalid(null, "").required(),
}).unknown(false).required();

export const publicApplicationSchema = registerSchema.append({
  publisherType,
  taxId,
  agencyName,
  phone: phoneSchema.invalid(null, "").required(),
});

export const applicationQuerySchema = Joi.object({
  status: Joi.string().valid("pending", "approved", "rejected").default("pending"),
}).unknown(false).required();

export const applicationIdSchema = Joi.object({
  id: Joi.string().uuid({ version: ["uuidv4"] }).required(),
}).unknown(false).required();

export const approveSchema = Joi.object({}).unknown(false);

export const rejectSchema = Joi.object({
  rejectionReason: Joi.string().trim().empty("").allow(null).default(null),
}).unknown(false).default({});
