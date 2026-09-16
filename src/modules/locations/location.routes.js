import { Router } from "express";
import * as controller from "./location.controller.js";
import validate from "../../middlewares/validate.js";
import asyncHandler from "../../utils/asyncHandler.js";
import { cityListQuerySchema, locationSearchQuerySchema } from "./location.validation.js";

const router = Router();

router.get("/provinces", asyncHandler(controller.provinces));
router.get("/cities", validate(cityListQuerySchema, "query"), asyncHandler(controller.cities));
router.get("/search", validate(locationSearchQuerySchema, "query"), asyncHandler(controller.search));

export default router;
