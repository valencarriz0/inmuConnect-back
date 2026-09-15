import Joi from "joi";
import { createUserSchema, emailSchema, passwordSchema } from "../users/user.validation.js";

export const registerSchema = createUserSchema.append({
  passwordConfirm: Joi.string().valid(Joi.ref("password")).required(),
});

export const loginSchema = Joi.object({
  email: emailSchema.required(),
  password: passwordSchema.required(),
}).unknown(false).required();
