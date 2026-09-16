import Joi from "joi";
import { phoneSchema } from "../users/user.validation.js";

const name = Joi.string().trim().min(2).pattern(/^(?=.*\p{L})[\p{L}\p{M} '\u2019-]+$/u);

export const adminUserParamsSchema = Joi.object({
  id: Joi.string().guid({ version: ["uuidv4"] }).required(),
});

export const adminUserListSchema = Joi.object({
  q: Joi.string().trim().min(1).max(100),
  role: Joi.string().valid("interested", "publisher"),
  status: Joi.string().valid("active", "disabled"),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

export const adminUpdateUserSchema = Joi.object({
  firstName: name,
  lastName: name,
  phone: phoneSchema,
}).min(1);
