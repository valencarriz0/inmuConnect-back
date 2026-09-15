import { Router } from "express";
import * as controller from "./publisherApplicationAdmin.controller.js";
import {
  applicationIdSchema,
  applicationQuerySchema,
  approveSchema,
  rejectSchema,
} from "../publishers/publisherApplication.validation.js";
import authenticate from "../../middlewares/authenticate.js";
import { authorizeRoles } from "../../middlewares/authorize.js";
import validate from "../../middlewares/validate.js";
import asyncHandler from "../../utils/asyncHandler.js";

const router = Router();
router.use(authenticate, authorizeRoles("admin"));
router.get("/", validate(applicationQuerySchema, "query"), asyncHandler(controller.list));
router.patch("/:id/approve", validate(applicationIdSchema, "params"), validate(approveSchema), asyncHandler(controller.approve));
router.patch("/:id/reject", validate(applicationIdSchema, "params"), validate(rejectSchema), asyncHandler(controller.reject));

export default router;
