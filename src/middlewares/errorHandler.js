import { STATUS_CODES } from "node:http";
import AppError from "../errors/AppError.js";

export default function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);

  const candidate = error.statusCode ?? error.status;
  const statusCode = Number.isInteger(candidate) && candidate >= 400 && candidate <= 599
    ? candidate
    : 500;

  if (error instanceof AppError) {
    return res.status(statusCode).json({
      error: error.message,
      ...(error.details ? { details: error.details } : {}),
    });
  }

  // Los mensajes originales pueden incluir datos del request o de la conexión.
  const message = statusCode >= 500
    ? "Error interno del servidor"
    : statusCode === 400
      ? "Solicitud inválida"
      : STATUS_CODES[statusCode] || "Error en la solicitud";

  res.status(statusCode).json({ error: message });
}
