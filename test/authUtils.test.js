import "../test-support/environment.js";
import assert from "node:assert/strict";
import { test } from "node:test";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { hashPassword, comparePassword } from "../src/utils/password.js";
import { signAccessToken, verifyAccessToken } from "../src/utils/jwt.js";
import serializeUser from "../src/serializers/userSerializer.js";
import User from "../src/models/User.js";
import { authorizeRoles } from "../src/middlewares/authorize.js";
import asyncHandler from "../src/utils/asyncHandler.js";
import AppError from "../src/errors/AppError.js";
import errorHandler from "../src/middlewares/errorHandler.js";

const id = "c54acdd0-348d-4f26-86d9-0e8da651c7b2";

test("bcrypt usa 12 rondas y verifica contraseñas correctas e incorrectas", async () => {
  const hash = await hashPassword("test-password");
  assert.notEqual(hash, "test-password");
  assert.equal(bcrypt.getRounds(hash), 12);
  assert.equal(await comparePassword("test-password", hash), true);
  assert.equal(await comparePassword("wrong-password", hash), false);
});

test("JWT firmado sólo incluye sub, iat y exp; vence a las ocho horas", () => {
  const token = signAccessToken(id);
  const payload = verifyAccessToken(token);
  assert.equal(payload.sub, id);
  assert.deepEqual(Object.keys(payload).sort(), ["exp", "iat", "sub"]);
  assert.equal(payload.exp - payload.iat, 8 * 60 * 60);
  assert.equal(jwt.decode(token, { complete: true }).header.alg, "HS256");
});

test("JWT manipulado, sin firma, con algoritmo ajeno o subject inválido se rechaza", () => {
  const token = signAccessToken(id);
  const parts = token.split(".");
  parts[1] = Buffer.from(JSON.stringify({ sub: "other-user" })).toString("base64url");
  const invalid = [
    parts.join("."),
    jwt.sign({ sub: id }, "", { algorithm: "none" }),
    jwt.sign({ sub: id }, process.env.JWT_SECRET, { algorithm: "HS384", expiresIn: "1h" }),
    jwt.sign({ sub: "invalid-uuid" }, process.env.JWT_SECRET, { expiresIn: "1h" }),
    jwt.sign({ sub: id }, process.env.JWT_SECRET),
  ];
  for (const value of invalid) assert.throws(() => verifyAccessToken(value));
});

test("serializer usa una lista explícita incluso con instancia unscoped y campos privados", () => {
  const user = User.unscoped().build({
    id, firstName: "Ana", lastName: "Pérez", email: "test@example.com", phone: null,
    role: "interested", accountStatus: "active", passwordHash: "private-hash",
    createdAt: new Date(), updatedAt: new Date(),
  });
  const result = serializeUser(user);
  assert.deepEqual(Object.keys(result).sort(),
    ["id", "firstName", "lastName", "email", "phone", "role", "accountStatus", "createdAt", "updatedAt"].sort());
  assert.equal(result.id, id);
  assert.ok(!JSON.stringify(result).includes("private-hash"));
});

for (const [user, status] of [[{ role: "admin" }, undefined], [{ role: "interested" }, 403], [undefined, 401]]) {
  test(`authorizeRoles: ${user?.role ?? "sin usuario"} → ${status ?? "next"}`, () => {
    let calls = 0;
    authorizeRoles("admin")({ user, body: { role: "admin" } }, {}, (error) => {
      calls++;
      assert.equal(error?.statusCode, status);
    });
    assert.equal(calls, 1);
  });
}

test("asyncHandler envía rechazos y errores sincrónicos a next", async () => {
  for (const handler of [() => { throw new Error("failure"); }, async () => { throw new Error("failure"); }]) {
    let forwarded;
    await asyncHandler(handler)({}, {}, (error) => { forwarded = error; });
    assert.equal(forwarded.message, "failure");
  }
});

test("errorHandler sólo conserva los mensajes explícitos de AppError", () => {
  for (const [error, status, message] of [
    [new AppError(401, "Credenciales inválidas."), 401, "Credenciales inválidas."],
    [new Error("password=DO_NOT_EXPOSE"), 500, "Error interno del servidor"],
  ]) {
    const response = { status(value) { this.statusCode = value; return this; }, json(value) { this.body = value; } };
    errorHandler(error, {}, response, () => assert.fail("unexpected next"));
    assert.equal(response.statusCode, status);
    assert.deepEqual(response.body, { error: message });
  }
});
