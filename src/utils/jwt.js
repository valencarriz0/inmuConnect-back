import jwt from "jsonwebtoken";
import env from "../config/env.js";

export function signAccessToken(userId) {
  return jwt.sign({}, env.JWT_SECRET, {
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
      !Number.isFinite(payload.exp)) {
    throw new Error("Token inválido.");
  }
  return payload;
}
