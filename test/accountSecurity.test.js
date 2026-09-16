import "../test-support/environment.js";
import assert from "node:assert/strict";
import { test } from "node:test";
import jwt from "jsonwebtoken";
import { generateAuthToken, hashAuthToken } from "../src/utils/authToken.js";
import { signAccessToken, verifyAccessToken } from "../src/utils/jwt.js";
import authenticate from "../src/middlewares/authenticate.js";
import User from "../src/models/User.js";
import AuthToken from "../src/models/AuthToken.js";
import sequelize from "../src/config/database.js";
import * as authService from "../src/modules/auth/auth.service.js";
import { hashPassword } from "../src/utils/password.js";

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

test("verify-email devuelve sólo el mensaje final y marca usuario y token", async (t) => {
  const user = { id, emailVerifiedAt: null, update: t.mock.fn(async (values) => Object.assign(user, values)) };
  const authToken = { userId: id, usedAt: null, expiresAt: new Date(Date.now() + 60_000), update: t.mock.fn(async (values) => Object.assign(authToken, values)) };
  t.mock.method(sequelize, "transaction", async (callback) => callback({ LOCK: { UPDATE: "UPDATE" } }));
  t.mock.method(AuthToken, "unscoped", () => ({ findOne: async () => authToken }));
  t.mock.method(AuthToken, "update", async () => [0]);
  t.mock.method(User, "findByPk", async () => user);
  const result = await authService.verifyEmail({ token: generateAuthToken() });
  assert.deepEqual(result, { message: "Correo verificado correctamente. Ya podés iniciar sesión." });
  assert.ok(user.emailVerifiedAt instanceof Date);
  assert.ok(authToken.usedAt instanceof Date);
});

test("change-password incrementa authVersion e invalida el JWT sin devolver sesión nueva", async (t) => {
  const passwordHash = await hashPassword("current-password");
  const user = { id, passwordHash, authVersion: 0, role: "interested", accountStatus: "active", emailVerifiedAt: new Date(), update: t.mock.fn(async (values) => Object.assign(user, values)) };
  t.mock.method(User, "unscoped", () => ({ findByPk: async () => user }));
  t.mock.method(sequelize, "transaction", async (callback) => callback({ LOCK: { UPDATE: "UPDATE" } }));
  t.mock.method(AuthToken, "update", async () => [0]);
  const result = await authService.changePassword({ id }, { currentPassword: "current-password", newPassword: "new-password", newPasswordConfirm: "new-password" });
  assert.deepEqual(result, { message: "Contraseña actualizada correctamente. Iniciá sesión nuevamente." });
  assert.equal(user.authVersion, 1);
  assert.notEqual(user.passwordHash, passwordHash);
});
