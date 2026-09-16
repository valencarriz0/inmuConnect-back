import { Router } from "express";
import * as controller from "./property.controller.js";
import validate from "../../middlewares/validate.js";
import asyncHandler from "../../utils/asyncHandler.js";
import { propertyListQuerySchema, propertyParamsSchema } from "./property.validation.js";
import { optionalAuthenticate } from "../../middlewares/authenticate.js";
import * as consultationController from "../consultations/consultation.controller.js";
import {
  consultationParamsSchema,
  createConsultationSchema,
} from "../consultations/consultation.validation.js";
import * as propertyViewController from "../views/propertyView.controller.js";

const router = Router();

router.get("/", validate(propertyListQuerySchema, "query"), asyncHandler(controller.list));
router.post(
  "/:id/consultations",
  optionalAuthenticate,
  validate(consultationParamsSchema, "params"),
  validate(createConsultationSchema),
  asyncHandler(consultationController.create),
);
router.post(
  "/:id/views",
  optionalAuthenticate,
  validate(propertyParamsSchema, "params"),
  asyncHandler(propertyViewController.create),
);
router.get("/:id", validate(propertyParamsSchema, "params"), asyncHandler(controller.detail));

export default router;
