import "../test-support/environment.js";
import assert from "node:assert/strict";
import { test } from "node:test";
import jwt from "jsonwebtoken";
import { generateAuthToken, hashAuthToken } from "../src/utils/authToken.js";
import { signAccessToken, verifyAccessToken } from "../src/utils/jwt.js";
import authenticate from "../src/middlewares/authenticate.js";
import User from "../src/models/User.js";

const id = "c54acdd0-348d-4f26-86d9-0e8da651c7b2";

test("los enlaces usan un valor aleatorio y sólo se persiste su hash SHA-256", () => {
  const first = generateAuthToken();
  const second = generateAuthToken();
  assert.notEqual(first, second);
  assert.match(first, /^[A-Za-z0-9_-]{40,}$/);
  assert.match(hashAuthToken(first), /^[a-f0-9]{64}$/);
  assert.notEqual(hashAuthToken(first), first);
});

test("el JWT incluye authVersion y un JWT anterior queda invalidado cuando cambia", async (t) => {
  const oldToken = signAccessToken({ id, authVersion: 0 });
  assert.equal(verifyAccessToken(oldToken).v, 0);
  t.mock.method(User, "findByPk", async () => ({ id, accountStatus: "active", authVersion: 1 }));
  const req = { get: (name) => name === "Authorization" ? `Bearer ${oldToken}` : undefined };
  let error;
  await authenticate(req, {}, (value) => { error = value; });
  assert.equal(error.statusCode, 401);
});

test("un JWT sin versión de autenticación no es aceptado", () => {
  const legacyToken = jwt.sign({ sub: id }, process.env.JWT_SECRET, { expiresIn: "1h" });
  assert.throws(() => verifyAccessToken(legacyToken));
});
