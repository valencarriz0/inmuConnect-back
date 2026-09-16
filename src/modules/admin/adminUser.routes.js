import { Router } from "express";
import authenticate from "../../middlewares/authenticate.js";
import { authorizeRoles } from "../../middlewares/authorize.js";
import validate from "../../middlewares/validate.js";
import asyncHandler from "../../utils/asyncHandler.js";
import * as controller from "./adminUser.controller.js";
import {
  adminUpdateUserSchema,
  adminUserListSchema,
  adminUserParamsSchema,
} from "./adminUser.validation.js";

const router = Router();
router.use(authenticate, authorizeRoles("admin"));
router.get("/", validate(adminUserListSchema, "query"), asyncHandler(controller.list));
router.patch("/:id/disable", validate(adminUserParamsSchema, "params"), asyncHandler(controller.disable));
router.patch("/:id/reactivate", validate(adminUserParamsSchema, "params"), asyncHandler(controller.reactivate));
router.patch(
  "/:id",
  validate(adminUserParamsSchema, "params"),
  validate(adminUpdateUserSchema),
  asyncHandler(controller.update),
);

export default router;
