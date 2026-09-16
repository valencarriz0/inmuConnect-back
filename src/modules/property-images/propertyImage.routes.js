import { Router } from "express";
import authenticate from "../../middlewares/authenticate.js";
import { authorizeRoles } from "../../middlewares/authorize.js";
import { imageUploadLimiter } from "../../middlewares/rateLimit.js";
import validate from "../../middlewares/validate.js";
import asyncHandler from "../../utils/asyncHandler.js";
import * as controller from "./propertyImage.controller.js";
import receivePropertyImages from "./propertyImage.upload.js";
import { deletePropertyImagesSchema } from "./propertyImage.validation.js";

const router = Router();
router.use(authenticate, authorizeRoles("publisher"));

router.post("/", imageUploadLimiter, receivePropertyImages, asyncHandler(controller.upload));
router.delete("/", validate(deletePropertyImagesSchema), asyncHandler(controller.remove));

export default router;
