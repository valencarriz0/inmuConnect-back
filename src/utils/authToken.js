import crypto from "node:crypto";

export function generateAuthToken() {
  return crypto.randomBytes(32).toString("base64url");
}

export function hashAuthToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}
