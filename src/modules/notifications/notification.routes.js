import { Router } from "express";
import authenticate from "../../middlewares/authenticate.js";
import validate from "../../middlewares/validate.js";
import asyncHandler from "../../utils/asyncHandler.js";
import * as controller from "./notification.controller.js";
import { notificationParamsSchema } from "./notification.validation.js";

const router = Router();
router.use(authenticate);
router.get("/", asyncHandler(controller.list));
router.patch("/read-all", asyncHandler(controller.markAllRead));
router.patch("/:id/read", validate(notificationParamsSchema, "params"), asyncHandler(controller.markRead));

export default router;
