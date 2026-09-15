import Joi from "joi";
import { normalizeEmail } from "../../utils/email.js";

const name = Joi.string().trim().min(2).pattern(/^(?=.*\p{L})[\p{L}\p{M} '\u2019-]+$/u);
export const phoneSchema = Joi.string().trim().allow(null, "").custom((value, helpers) => {
  if (!value) return null;
  const digits = value.replace(/\D/g, "").length;
  if (!/^[+\d ()-]+$/.test(value) || digits < 7 || digits > 15) {
    return helpers.error("any.invalid");
  }
  return value;
});

export const emailSchema = Joi.string().trim().custom(normalizeEmail).email({ tlds: { allow: false } });
export const passwordSchema = Joi.string().min(6).max(72).custom((value, helpers) =>
  Buffer.byteLength(value, "utf8") <= 72 ? value : helpers.error("any.invalid"));

export const createUserSchema = Joi.object({
  firstName: name.required(),
  lastName: name.required(),
  email: emailSchema.required(),
  phone: phoneSchema.default(null),
  password: passwordSchema.required(),
}).unknown(false).required();

export const updateMeSchema = Joi.object({
  firstName: name,
  lastName: name,
  phone: phoneSchema,
}).min(1).unknown(false).required();
