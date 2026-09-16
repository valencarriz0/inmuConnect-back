import { Router } from "express";
import * as controller from "./location.controller.js";
import validate from "../../middlewares/validate.js";
import asyncHandler from "../../utils/asyncHandler.js";
import authenticate from "../../middlewares/authenticate.js";
import { authorizeRoles } from "../../middlewares/authorize.js";
import { geocodeLimiter } from "../../middlewares/rateLimit.js";
import { cityListQuerySchema, geocodeBodySchema, locationSearchQuerySchema } from "./location.validation.js";

const router = Router();

router.get("/provinces", asyncHandler(controller.provinces));
router.get("/cities", validate(cityListQuerySchema, "query"), asyncHandler(controller.cities));
router.get("/search", validate(locationSearchQuerySchema, "query"), asyncHandler(controller.search));
router.post(
  "/geocode",
  geocodeLimiter,
  authenticate,
  authorizeRoles("publisher", "admin"),
  validate(geocodeBodySchema),
  asyncHandler(controller.geocode),
);

export default router;
