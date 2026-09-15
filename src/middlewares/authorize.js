import AppError from "../errors/AppError.js";

export function authorizeRoles(...roles) {
  return (req, res, next) => {
    if (!req.user) return next(new AppError(401, "No autenticado."));
    if (!roles.includes(req.user.role)) return next(new AppError(403, "Acceso denegado."));
    next();
  };
}
