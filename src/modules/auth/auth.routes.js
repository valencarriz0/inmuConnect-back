import { Router } from "express";
import * as controller from "./auth.controller.js";
import { changePasswordSchema, forgotPasswordSchema, loginSchema, registerSchema, resendVerificationSchema, resetPasswordSchema, verifyEmailSchema } from "./auth.validation.js";
import validate from "../../middlewares/validate.js";
import authenticate from "../../middlewares/authenticate.js";
import { authLimiter } from "../../middlewares/rateLimit.js";
import asyncHandler from "../../utils/asyncHandler.js";

const router = Router();
router.post("/register", authLimiter, validate(registerSchema), asyncHandler(controller.register));
router.post("/login", authLimiter, validate(loginSchema), asyncHandler(controller.login));
router.post("/verify-email", authLimiter, validate(verifyEmailSchema), asyncHandler(controller.verifyEmail));
router.post("/resend-verification", authLimiter, validate(resendVerificationSchema), asyncHandler(controller.resendVerification));
router.post("/forgot-password", authLimiter, validate(forgotPasswordSchema), asyncHandler(controller.forgotPassword));
router.post("/reset-password", authLimiter, validate(resetPasswordSchema), asyncHandler(controller.resetPassword));
router.patch("/change-password", authenticate, authLimiter, validate(changePasswordSchema), asyncHandler(controller.changePassword));
router.get("/me", authenticate, controller.me);

export default router;
