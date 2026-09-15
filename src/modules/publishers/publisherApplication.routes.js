import { Router } from "express";
import * as controller from "./publisherApplication.controller.js";
import { applicationSchema, publicApplicationSchema } from "./publisherApplication.validation.js";
import authenticate from "../../middlewares/authenticate.js";
import validate from "../../middlewares/validate.js";
import { authLimiter } from "../../middlewares/rateLimit.js";
import asyncHandler from "../../utils/asyncHandler.js";

const router = Router();

router.post("/public", authLimiter, validate(publicApplicationSchema), asyncHandler(controller.registerPublic));
router.post("/", authenticate, validate(applicationSchema), asyncHandler(controller.create));
router.get("/me", authenticate, asyncHandler(controller.me));

export default router;
