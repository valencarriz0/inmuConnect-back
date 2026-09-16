import { Router } from "express";
import authenticate from "../../middlewares/authenticate.js";
import { authorizeRoles } from "../../middlewares/authorize.js";
import validate from "../../middlewares/validate.js";
import asyncHandler from "../../utils/asyncHandler.js";
import * as controller from "./adminProperty.controller.js";
import {
  adminPropertyListSchema,
  adminPropertyParamsSchema,
  adminUpdatePropertySchema,
} from "./adminProperty.validation.js";

const router = Router();
router.use(authenticate, authorizeRoles("admin"));
router.get("/", validate(adminPropertyListSchema, "query"), asyncHandler(controller.list));
router.get("/:id/history", validate(adminPropertyParamsSchema, "params"), asyncHandler(controller.history));
router.patch("/:id/pause", validate(adminPropertyParamsSchema, "params"), asyncHandler(controller.pause));
router.patch("/:id/reactivate", validate(adminPropertyParamsSchema, "params"), asyncHandler(controller.reactivate));
router.get("/:id", validate(adminPropertyParamsSchema, "params"), asyncHandler(controller.detail));
router.patch(
  "/:id",
  validate(adminPropertyParamsSchema, "params"),
  validate(adminUpdatePropertySchema),
  asyncHandler(controller.update),
);
router.delete("/:id", validate(adminPropertyParamsSchema, "params"), asyncHandler(controller.remove));

export default router;
