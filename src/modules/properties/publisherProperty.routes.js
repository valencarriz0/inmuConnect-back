import { Router } from "express";
import authenticate from "../../middlewares/authenticate.js";
import { authorizeRoles } from "../../middlewares/authorize.js";
import validate from "../../middlewares/validate.js";
import asyncHandler from "../../utils/asyncHandler.js";
import * as controller from "./publisherProperty.controller.js";
import {
  createPublisherPropertySchema,
  publisherPropertyListQuerySchema,
  publisherPropertyParamsSchema,
  updatePublisherPropertySchema,
} from "./publisherProperty.validation.js";

const router = Router();
router.use(authenticate, authorizeRoles("publisher"));

router.get("/", validate(publisherPropertyListQuerySchema, "query"), asyncHandler(controller.list));
router.post("/", validate(createPublisherPropertySchema), asyncHandler(controller.create));
router.get("/:id/history", validate(publisherPropertyParamsSchema, "params"), asyncHandler(controller.history));
router.patch("/:id/pause", validate(publisherPropertyParamsSchema, "params"), asyncHandler(controller.pause));
router.patch("/:id/reactivate", validate(publisherPropertyParamsSchema, "params"), asyncHandler(controller.reactivate));
router.get("/:id", validate(publisherPropertyParamsSchema, "params"), asyncHandler(controller.detail));
router.patch(
  "/:id",
  validate(publisherPropertyParamsSchema, "params"),
  validate(updatePublisherPropertySchema),
  asyncHandler(controller.update),
);
router.delete("/:id", validate(publisherPropertyParamsSchema, "params"), asyncHandler(controller.remove));

export default router;
