import { Router } from "express";
import authenticate from "../../middlewares/authenticate.js";
import { authorizeRoles } from "../../middlewares/authorize.js";
import validate from "../../middlewares/validate.js";
import asyncHandler from "../../utils/asyncHandler.js";
import { detail } from "./publisherMetric.controller.js";
import { publisherMetricQuerySchema } from "./publisherMetric.validation.js";

const router = Router();
router.get("/", authenticate, authorizeRoles("publisher"), validate(publisherMetricQuerySchema, "query"), asyncHandler(detail));

export default router;
