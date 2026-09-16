import { Router } from "express";
import authenticate from "../../middlewares/authenticate.js";
import { authorizeRoles } from "../../middlewares/authorize.js";
import validate from "../../middlewares/validate.js";
import asyncHandler from "../../utils/asyncHandler.js";
import { listReceived } from "./consultation.controller.js";
import { publisherConsultationQuerySchema } from "./consultation.validation.js";

const router = Router();
router.get(
  "/",
  authenticate,
  authorizeRoles("publisher"),
  validate(publisherConsultationQuerySchema, "query"),
  asyncHandler(listReceived),
);

export default router;
