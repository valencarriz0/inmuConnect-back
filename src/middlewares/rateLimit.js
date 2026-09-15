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
