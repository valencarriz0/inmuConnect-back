import rateLimit from "express-rate-limit";
import env from "../config/env.js";

export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.NODE_ENV === "production" ? 300 : 1000,
  message: {
    error: "Demasiadas solicitudes desde esta IP. Intentá nuevamente más tarde.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.NODE_ENV === "production" ? 15 : 1000,
  message: { error: "Demasiados intentos. Intentá nuevamente más tarde." },
  standardHeaders: true,
  legacyHeaders: false,
});

export const geocodeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.NODE_ENV === "production" ? 30 : 1000,
  message: { error: "Demasiadas solicitudes de geocodificación. Intentá nuevamente más tarde." },
  standardHeaders: true,
  legacyHeaders: false,
});
