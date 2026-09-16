import { Router } from "express";
import { updateMe } from "./user.controller.js";
import { propertyViewHistoryQuerySchema, updateMeSchema } from "./user.validation.js";
import authenticate from "../../middlewares/authenticate.js";
import validate from "../../middlewares/validate.js";
import asyncHandler from "../../utils/asyncHandler.js";
import { authorizeRoles } from "../../middlewares/authorize.js";
import * as consultationController from "../consultations/consultation.controller.js";
import * as favoriteController from "../favorites/favorite.controller.js";
import { favoriteParamsSchema } from "../favorites/favorite.validation.js";
import * as propertyViewController from "../views/propertyView.controller.js";
import searchAlertRouter from "../search-alerts/searchAlert.routes.js";

const router = Router();
router.use("/me/search-alerts", searchAlertRouter);
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
router.get(
  "/me/views",
  authenticate,
  authorizeRoles("interested", "publisher"),
  validate(propertyViewHistoryQuerySchema, "query"),
  asyncHandler(propertyViewController.listMine),
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
