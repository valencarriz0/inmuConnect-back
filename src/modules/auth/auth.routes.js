import { Router } from "express";
import * as controller from "./auth.controller.js";
import { registerSchema, loginSchema } from "./auth.validation.js";
import validate from "../../middlewares/validate.js";
import authenticate from "../../middlewares/authenticate.js";
import { authLimiter } from "../../middlewares/rateLimit.js";
import asyncHandler from "../../utils/asyncHandler.js";

const router = Router();
router.post("/register", authLimiter, validate(registerSchema), asyncHandler(controller.register));
router.post("/login", authLimiter, validate(loginSchema), asyncHandler(controller.login));
router.get("/me", authenticate, controller.me);

export default router;
