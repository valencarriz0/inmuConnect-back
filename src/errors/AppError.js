export default class AppError extends Error {
  // Usar sólo mensajes y detalles públicos definidos por la aplicación.
  constructor(statusCode, message, details, code) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    if (details) this.details = details;
    if (code) this.code = code;
  }
}
