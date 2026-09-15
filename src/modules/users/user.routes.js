import { Router } from "express";
import { updateMe } from "./user.controller.js";
import { updateMeSchema } from "./user.validation.js";
import authenticate from "../../middlewares/authenticate.js";
import validate from "../../middlewares/validate.js";
import asyncHandler from "../../utils/asyncHandler.js";

const router = Router();
router.patch("/me", authenticate, validate(updateMeSchema), asyncHandler(updateMe));

export default router;
