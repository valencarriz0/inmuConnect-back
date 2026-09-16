import { Router } from "express";
import { updateMe } from "./user.controller.js";
import { updateMeSchema } from "./user.validation.js";
import authenticate from "../../middlewares/authenticate.js";
import validate from "../../middlewares/validate.js";
import asyncHandler from "../../utils/asyncHandler.js";
import { authorizeRoles } from "../../middlewares/authorize.js";
import * as consultationController from "../consultations/consultation.controller.js";
import * as favoriteController from "../favorites/favorite.controller.js";
import { favoriteParamsSchema } from "../favorites/favorite.validation.js";

const router = Router();
router.patch("/me", authenticate, validate(updateMeSchema), asyncHandler(updateMe));
router.get(
  "/me/consultations",
  authenticate,
  authorizeRoles("interested", "publisher"),
  asyncHandler(consultationController.listMine),
);
router.get(
  "/me/favorites",
  authenticate,
  authorizeRoles("interested", "publisher"),
  asyncHandler(favoriteController.list),
);
router.put(
  "/me/favorites/:propertyId",
  authenticate,
  authorizeRoles("interested", "publisher"),
  validate(favoriteParamsSchema, "params"),
  asyncHandler(favoriteController.add),
);
router.delete(
  "/me/favorites/:propertyId",
  authenticate,
  authorizeRoles("interested", "publisher"),
  validate(favoriteParamsSchema, "params"),
  asyncHandler(favoriteController.remove),
);

export default router;
