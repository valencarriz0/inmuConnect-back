import jwt from "jsonwebtoken";
import Usuario from "../models/Usuario.js";
import {
  hashPassword,
  verifyPassword,
  generateToken,
  verifyToken,
} from "../utils/auth.js";

// Middleware para verificar token JWT
export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: "Token de acceso requerido" });
  }

  try {
    const user = verifyToken(token);
    req.user = user;
    next();
  } catch (err) {
    return res.status(403).json({ error: "Token inválido" });
  }
};

// Función para login
export const login = async (email, password) => {
  const user = await Usuario.findOne({ where: { email } });
  if (!user) {
    throw new Error("Usuario no encontrado");
  }

  const isValidPassword = await verifyPassword(password, user.password);
  if (!isValidPassword) {
    throw new Error("Contraseña incorrecta");
  }

  const token = generateToken(user);
  return {
    user: {
      id: user.id,
      nombre: user.nombre,
      apellido: user.apellido,
      email: user.email,
    },
    token,
  };
};
