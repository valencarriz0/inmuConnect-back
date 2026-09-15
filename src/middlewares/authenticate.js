import User from "../models/User.js";
import AppError from "../errors/AppError.js";
import { verifyAccessToken } from "../utils/jwt.js";
import asyncHandler from "../utils/asyncHandler.js";

export default asyncHandler(async (req, res, next) => {
  const match = /^Bearer ([^\s]+)$/i.exec(req.get("Authorization") ?? "");
  if (!match) throw new AppError(401, "No autenticado.");

  let payload;
  try {
    payload = verifyAccessToken(match[1]);
  } catch {
    throw new AppError(401, "No autenticado.");
  }

  const user = await User.findByPk(payload.sub);
  if (!user) throw new AppError(401, "No autenticado.");
  if (user.accountStatus !== "active") throw new AppError(403, "Cuenta deshabilitada.");
  req.user = user;
  next();
});
