import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

// === Función para hashear contraseña ===
export const hashPassword = async (password) => {
  const saltRounds = 10;
  return await bcrypt.hash(password, saltRounds);
};

// === Función para verificar contraseña ===
export const verifyPassword = async (password, hashedPassword) => {
  console.log("Verifying password:", password, "against hash:", hashedPassword);
  return await bcrypt.compare(password, hashedPassword);
};

// === Función para generar token JWT ===
export const generateToken = (user) => {
  const JWT_SECRET = process.env.JWT_SECRET || "mi_clave_secreta_para_jwt";
  return jwt.sign(
    { id: user.id, email: user.email },
    JWT_SECRET,
    { expiresIn: "1h" } // token expira en 1 hora
  );
};

// === Función para verificar token JWT ===
export const verifyToken = (token) => {
  const JWT_SECRET = process.env.JWT_SECRET || "mi_clave_secreta_para_jwt";
  return jwt.verify(token, JWT_SECRET);
};
