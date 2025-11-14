import express from "express";
import { authenticateToken } from "../middleware/auth.js"; // middleware para JWT
import {
  updateUsuario,
  usuarioLogin,
  getUsuarios,
  getUsuarioById,
  createUsuario,
  deleteUsuario,
} from "../controllers/usuarioController.js"; // función login separada (si querés, la podemos mover acá también)

const router = express.Router();

// === GET /api/usuarios ===
// Obtener todos los usuarios (requiere autenticación)
router.get("/", authenticateToken, getUsuarios);

// === GET /api/usuarios/:id ===
// Obtener un usuario por ID
router.get("/:id", getUsuarioById);

// === POST /api/usuarios/login ===
// Login de usuario
router.post("/login", usuarioLogin);

// === POST /api/usuarios ===
// Crear nuevo usuario
router.post("/", createUsuario);

// === PUT /api/usuarios/:id ===
// Actualizar un usuario existente
router.put("/:id", authenticateToken, updateUsuario);

// === DELETE /api/usuarios/:id ===
// Eliminar un usuario
router.delete("/:id", authenticateToken, deleteUsuario);

export default router;
