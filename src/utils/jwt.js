import jwt from "jsonwebtoken";
import env from "../config/env.js";

export function signAccessToken(userOrId, authVersion = 0) {
  const userId = typeof userOrId === "string" ? userOrId : userOrId.id;
  const version = typeof userOrId === "string" ? authVersion : userOrId.authVersion ?? 0;
  return jwt.sign({ v: version }, env.JWT_SECRET, {
    subject: userId,
    algorithm: "HS256",
    expiresIn: env.JWT_EXPIRES_IN,
  });
}

export function verifyAccessToken(token) {
  const payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ["HS256"] });
  if (typeof payload !== "object" ||
      typeof payload.sub !== "string" ||
      !/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(payload.sub) ||
      !Number.isFinite(payload.exp) || !Number.isInteger(payload.v) || payload.v < 0) {
    throw new Error("Token inválido.");
  }
  return payload;
}
