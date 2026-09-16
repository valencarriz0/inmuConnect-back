import Joi from "joi";
import { createUserSchema, emailSchema, passwordSchema } from "../users/user.validation.js";

export const registerSchema = createUserSchema.append({
  passwordConfirm: Joi.string().valid(Joi.ref("password")).required(),
});

export const loginSchema = Joi.object({
  email: emailSchema.required(),
  password: passwordSchema.required(),
}).unknown(false).required();

export const verifyEmailSchema = Joi.object({ token: Joi.string().trim().min(20).max(512).required() }).unknown(false).required();
export const resendVerificationSchema = Joi.object({ email: emailSchema.required() }).unknown(false).required();
export const forgotPasswordSchema = resendVerificationSchema;
export const resetPasswordSchema = Joi.object({ token: Joi.string().trim().min(20).max(512).required(), password: passwordSchema.required(), passwordConfirm: Joi.string().valid(Joi.ref("password")).required() }).unknown(false).required();
export const changePasswordSchema = Joi.object({ currentPassword: passwordSchema.required(), newPassword: passwordSchema.required(), newPasswordConfirm: Joi.string().valid(Joi.ref("newPassword")).required() }).unknown(false).required();
