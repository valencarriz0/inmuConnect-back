import { Router } from "express";
import authenticate from "../../middlewares/authenticate.js";
import { authorizeRoles } from "../../middlewares/authorize.js";
import asyncHandler from "../../utils/asyncHandler.js";
import { detail } from "./adminMetric.controller.js";

const router = Router();
router.get("/", authenticate, authorizeRoles("admin"), asyncHandler(detail));

export default router;
