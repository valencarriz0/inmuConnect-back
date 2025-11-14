import express from "express";
import {
  getPublicaciones,
  createPublicacion,
  getPublicacionesById,
} from "../controllers/publicacionController.js";

const router = express.Router();

router.get("/", getPublicaciones);
router.get("/:id", getPublicacionesById);
router.post("/", createPublicacion);

export default router;
