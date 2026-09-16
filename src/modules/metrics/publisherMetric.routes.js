import { Router } from "express";
import authenticate from "../../middlewares/authenticate.js";
import { authorizeRoles } from "../../middlewares/authorize.js";
import asyncHandler from "../../utils/asyncHandler.js";
import { detail } from "./publisherMetric.controller.js";

const router = Router();
router.get("/", authenticate, authorizeRoles("publisher"), asyncHandler(detail));

export default router;
