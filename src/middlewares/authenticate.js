import User from "../models/User.js";
import AppError from "../errors/AppError.js";
import { verifyAccessToken } from "../utils/jwt.js";
import asyncHandler from "../utils/asyncHandler.js";

async function resolveUser(req, required) {
  const match = /^Bearer ([^\s]+)$/i.exec(req.get("Authorization") ?? "");
  if (!match) {
    if (!required && !req.get("Authorization")) return null;
    throw new AppError(401, "No autenticado.");
  }

  let payload;
  try {
    payload = verifyAccessToken(match[1]);
  } catch {
    throw new AppError(401, "No autenticado.");
  }

  const user = await User.findByPk(payload.sub);
  if (!user) throw new AppError(401, "No autenticado.");
  if (user.accountStatus !== "active") throw new AppError(403, "Cuenta deshabilitada.");
  return user;
}

const authenticate = asyncHandler(async (req, res, next) => {
  req.user = await resolveUser(req, true);
  next();
});

export const optionalAuthenticate = asyncHandler(async (req, res, next) => {
  const user = await resolveUser(req, false);
  if (user) req.user = user;
  next();
});

export default authenticate;
