import { Router } from "express";
import * as controller from "./property.controller.js";
import validate from "../../middlewares/validate.js";
import asyncHandler from "../../utils/asyncHandler.js";
import { propertyListQuerySchema, propertyParamsSchema } from "./property.validation.js";

const router = Router();

router.get("/", validate(propertyListQuerySchema, "query"), asyncHandler(controller.list));
router.get("/:id", validate(propertyParamsSchema, "params"), asyncHandler(controller.detail));

export default router;
