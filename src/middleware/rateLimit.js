import rateLimit from "express-rate-limit";

export const generalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutos
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // 100 requests por ventana
  message: {
    error:
      "Demasiadas solicitudes desde esta IP, por favor intenta de nuevo más tarde.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Limiter para rutas de login
export const authLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutos
  max: parseInt(process.env.RATE_LIMIT_LOGIN_MAX) || 5, // 5 intentos de login
  message: {
    error:
      "Demasiados intentos de login, por favor intenta de nuevo más tarde.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Limiter para creación de usuarios
export const createUserLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: parseInt(process.env.RATE_LIMIT_REGISTER_MAX) || 10, // Máximo 10 usuarios por hora
  message: {
    error:
      "Demasiadas creaciones de usuario desde esta IP, por favor intenta de nuevo más tarde.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});
