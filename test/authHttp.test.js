import "../test-support/environment.js";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { after, before, mock, test } from "node:test";
import { Sequelize, UniqueConstraintError } from "sequelize";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import app from "../src/app.js";
import User from "../src/models/User.js";
import { hashPassword, comparePassword } from "../src/utils/password.js";
import { signAccessToken, verifyAccessToken } from "../src/utils/jwt.js";
import { createUser } from "../src/modules/users/user.service.js";
import sequelize from "../src/config/database.js";

const queryGuard = mock.method(Sequelize.prototype, "query", () => assert.fail("La prueba no puede ejecutar SQL"));
const id = "c54acdd0-348d-4f26-86d9-0e8da651c7b2";
const password = "test-password";
const registration = {
  firstName: "  María José  ", lastName: "  O’Connor-Pérez  ", email: "  TEST@EXAMPLE.COM  ",
  phone: "", password, passwordConfirm: password,
};
let passwordHash;
let server;
let baseUrl;

function user(overrides = {}) {
  return User.unscoped().build({
    id, firstName: "María José", lastName: "O’Connor-Pérez", email: "test@example.com",
    phone: null, passwordHash, role: "interested", accountStatus: "active",
    createdAt: new Date("2026-01-01T00:00:00Z"), updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  });
}

async function request(path, { method = "GET", body, token, headers = {} } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  return { status: response.status, body: await response.json(), headers: response.headers };
}

function assertPublic(body) {
  assert.ok(!JSON.stringify(body).includes("passwordHash"));
  assert.ok(!JSON.stringify(body).includes("password_hash"));
  assert.ok(!JSON.stringify(body).includes(passwordHash));
}

function mockLogin(t, found) {
  const findOne = t.mock.fn(async () => found);
  t.mock.method(User, "unscoped", () => ({ findOne }));
  return findOne;
}

before(async () => {
  passwordHash = await hashPassword(password);
  server = createServer(app);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server?.listening) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  assert.equal(queryGuard.mock.callCount(), 0, "No debe intentarse ninguna consulta real");
});

test("register normaliza datos, guarda bcrypt y devuelve sólo usuario público y JWT", async (t) => {
  const findOne = t.mock.method(User, "findOne", async () => null);
  let stored;
  t.mock.method(User, "create", async (data) => { stored = data; return user(data); });
  const result = await request("/api/auth/register", { method: "POST", body: registration });
  assert.equal(result.status, 201);
  assert.equal(stored.firstName, "María José");
  assert.equal(stored.lastName, "O’Connor-Pérez");
  assert.equal(stored.email, "test@example.com");
  assert.equal(stored.phone, null);
  assert.equal(stored.role, "interested");
  assert.equal(stored.accountStatus, "active");
  assert.equal(bcrypt.getRounds(stored.passwordHash), 12);
  assert.equal(await comparePassword(password, stored.passwordHash), true);
  assert.deepEqual(Object.keys(stored).sort(),
    ["firstName", "lastName", "email", "phone", "passwordHash", "role", "accountStatus"].sort());
  const whereSql = sequelize.getQueryInterface().queryGenerator.whereQuery(findOne.mock.calls[0].arguments[0].where);
  assert.match(whereSql, /lower\("email"\) = 'test@example.com'/);
  assert.equal(verifyAccessToken(result.body.token).sub, id);
  assertPublic(result.body);
  assert.ok(!JSON.stringify(result.body).includes(stored.passwordHash));
});

test("createUser propaga la transacción externa a búsqueda y creación sin finalizarla", async (t) => {
  const transaction = { commit: t.mock.fn(), rollback: t.mock.fn() };
  const findOne = t.mock.method(User, "findOne", async () => null);
  const create = t.mock.method(User, "create", async (data) => user(data));
  const { passwordConfirm, ...input } = registration;
  const result = await createUser(input, { transaction });
  assert.equal(findOne.mock.calls[0].arguments[0].transaction, transaction);
  assert.equal(create.mock.calls[0].arguments[1].transaction, transaction);
  assert.equal(transaction.commit.mock.callCount(), 0);
  assert.equal(transaction.rollback.mock.callCount(), 0);
  assert.equal(result.id, id);
  assert.equal(result.role, "interested");
  assertPublic(result);
});

test("createUser deja el rollback al caller si hay una colisión concurrente", async (t) => {
  const transaction = { commit: t.mock.fn(), rollback: t.mock.fn() };
  t.mock.method(User, "findOne", async () => null);
  t.mock.method(User, "create", async (_, options) => {
    assert.equal(options.transaction, transaction);
    throw new UniqueConstraintError({ parent: { constraint: "users_email_unique" } });
  });
  const { passwordConfirm, ...input } = registration;
  await assert.rejects(createUser(input, { transaction }), { statusCode: 409 });
  assert.equal(transaction.commit.mock.callCount(), 0);
  assert.equal(transaction.rollback.mock.callCount(), 0);
});

test("createUser valida por sí mismo y rechaza privilegios de otros callers", async (t) => {
  const findOne = t.mock.method(User, "findOne", () => assert.fail("No debe consultar"));
  const { passwordConfirm, ...input } = registration;
  await assert.rejects(createUser({ ...input, role: "publisher" }), { statusCode: 400 });
  assert.equal(findOne.mock.callCount(), 0);
});

for (const phone of [undefined, null, "   "]) {
  test(`register normaliza teléfono ${JSON.stringify(phone)} a null`, async (t) => {
    t.mock.method(User, "findOne", async () => null);
    t.mock.method(User, "create", async (data) => {
      assert.equal(data.phone, null);
      return user(data);
    });
    const result = await request("/api/auth/register", { method: "POST", body: { ...registration, phone } });
    assert.equal(result.status, 201);
    assert.equal(result.body.user.phone, null);
  });
}

test("register detecta correo existente antes de intentar crear", async (t) => {
  t.mock.method(User, "findOne", async () => user());
  const create = t.mock.method(User, "create", () => assert.fail("No debe crear"));
  const result = await request("/api/auth/register", { method: "POST", body: registration });
  assert.equal(result.status, 409);
  assert.deepEqual(result.body, { error: "El correo electrónico ya está registrado." });
  assert.equal(create.mock.callCount(), 0);
});

for (const [constraint, expected] of [["users_email_unique", 409], ["users_pkey", 500]]) {
  test(`register convierte sólo la unicidad del correo a 409 (${constraint})`, async (t) => {
    t.mock.method(User, "findOne", async () => null);
    t.mock.method(User, "create", async () => {
      throw new UniqueConstraintError({ message: "DO_NOT_EXPOSE", parent: { constraint, detail: "DO_NOT_EXPOSE" } });
    });
    const result = await request("/api/auth/register", { method: "POST", body: registration });
    assert.equal(result.status, expected);
    assert.deepEqual(result.body, { error: expected === 409 ? "El correo electrónico ya está registrado." : "Error interno del servidor" });
  });
}

const invalidRegister = [
  ["confirmación distinta", { passwordConfirm: "different" }],
  ["confirmación ausente", { passwordConfirm: undefined }],
  ["contraseña corta", { password: "12345", passwordConfirm: "12345" }],
  ["contraseña larga", { password: "x".repeat(73), passwordConfirm: "x".repeat(73) }],
  ["contraseña UTF-8 mayor a 72 bytes", { password: "á".repeat(37), passwordConfirm: "á".repeat(37) }],
  ["email inválido", { email: "invalid" }],
  ["nombre inválido", { firstName: "Ana123" }],
  ["apellido inválido", { lastName: "<script>" }],
  ["nombre sin letras", { firstName: "--" }],
  ["teléfono corto", { phone: "123456" }],
  ["teléfono largo", { phone: "1234567890123456" }],
  ["teléfono con letras", { phone: "abc1234567" }],
  ...["role", "accountStatus", "passwordHash", "id", "userId", "createdAt", "updatedAt", "publisherType", "taxId", "agencyName"]
    .map((field) => [field, { [field]: "DO_NOT_EXPOSE" }]),
];
for (const [label, override] of invalidRegister) {
  test(`register rechaza ${label} antes de persistir`, async (t) => {
    const findOne = t.mock.method(User, "findOne", () => assert.fail("No debe consultar"));
    const result = await request("/api/auth/register", { method: "POST", body: { ...registration, ...override } });
    assert.equal(result.status, 400);
    assert.equal(findOne.mock.callCount(), 0);
    assert.ok(!JSON.stringify(result.body).includes("DO_NOT_EXPOSE"));
    assert.ok(!JSON.stringify(result.body).includes(password));
  });
}

test("login usa unscoped y búsqueda case-insensitive, devuelve JWT sin hash", async (t) => {
  const found = user();
  const findOne = mockLogin(t, found);
  const result = await request("/api/auth/login", { method: "POST", body: { email: "  TEST@EXAMPLE.COM ", password } });
  assert.equal(result.status, 200);
  assert.equal(User.unscoped.mock.callCount(), 1);
  const condition = findOne.mock.calls[0].arguments[0].where;
  const whereSql = sequelize.getQueryInterface().queryGenerator.whereQuery(condition);
  assert.match(whereSql, /lower\("email"\) = 'test@example.com'/);
  assert.equal(verifyAccessToken(result.body.token).sub, id);
  assertPublic(result.body);
});

test("correo inexistente y contraseña incorrecta devuelven el mismo 401", async (t) => {
  const found = user();
  let current = null;
  t.mock.method(User, "unscoped", () => ({ findOne: async () => current }));
  const missing = await request("/api/auth/login", { method: "POST", body: { email: "missing@example.com", password } });
  current = found;
  const wrong = await request("/api/auth/login", { method: "POST", body: { email: found.email, password: "wrong-password" } });
  assert.equal(missing.status, 401);
  assert.equal(wrong.status, 401);
  assert.deepEqual(missing.body, { error: "Credenciales inválidas." });
  assert.deepEqual(wrong.body, missing.body);
});

test("login sólo informa cuenta disabled tras verificar la contraseña y no emite token", async (t) => {
  mockLogin(t, user({ accountStatus: "disabled" }));
  const wrong = await request("/api/auth/login", { method: "POST", body: { email: "test@example.com", password: "wrong-password" } });
  assert.equal(wrong.status, 401);
  const result = await request("/api/auth/login", { method: "POST", body: { email: "test@example.com", password } });
  assert.equal(result.status, 403);
  assert.deepEqual(result.body, { error: "Cuenta deshabilitada." });
  assert.equal(result.body.token, undefined);
});

for (const body of [{}, { email: "bad", password }, { email: "test@example.com", password, role: "admin" }]) {
  test(`login rechaza body inválido con claves ${Object.keys(body).join(",")}`, async (t) => {
    const unscoped = t.mock.method(User, "unscoped", () => assert.fail("No debe consultar"));
    assert.equal((await request("/api/auth/login", { method: "POST", body })).status, 400);
    assert.equal(unscoped.mock.callCount(), 0);
  });
}

for (const [label, authorization] of [
  ["ausente", undefined], ["Basic", "Basic abc"], ["Bearer vacío", "Bearer"],
  ["inválido", "Bearer invalid.jwt.token"], ["componentes extra", "Bearer a b"],
  ["vencido", `Bearer ${jwt.sign({ sub: id }, process.env.JWT_SECRET, { expiresIn: -1 })}`],
  ["subject inválido", `Bearer ${jwt.sign({ sub: "not-a-uuid" }, process.env.JWT_SECRET, { expiresIn: "1h" })}`],
]) {
  test(`authenticate rechaza token ${label} sin consultar PostgreSQL`, async (t) => {
    const find = t.mock.method(User, "findByPk", () => assert.fail("No debe consultar"));
    const result = await request("/api/auth/me", { headers: authorization ? { Authorization: authorization } : {} });
    assert.equal(result.status, 401);
    assert.deepEqual(result.body, { error: "No autenticado." });
    assert.equal(find.mock.callCount(), 0);
  });
}

test("authenticate rechaza usuario inexistente o disabled", async (t) => {
  const disabled = user({ accountStatus: "disabled" });
  let current = null;
  t.mock.method(User, "findByPk", async () => current);
  const token = signAccessToken(id);
  assert.equal((await request("/api/auth/me", { token })).status, 401);
  current = disabled;
  const result = await request("/api/auth/me", { token });
  assert.equal(result.status, 403);
  assert.deepEqual(result.body, { error: "Cuenta deshabilitada." });
});

test("me usa el usuario actual y desoye role y accountStatus del JWT", async (t) => {
  const current = user();
  const find = t.mock.method(User, "findByPk", async (userId) => {
    assert.equal(userId, id);
    return current;
  });
  const token = jwt.sign({ sub: id, role: "admin", accountStatus: "active" }, process.env.JWT_SECRET, { expiresIn: "1h" });
  let result = await request("/api/auth/me", { token });
  assert.equal(result.status, 200);
  assert.equal(result.body.user.role, "interested");
  assertPublic(result.body);
  current.role = "publisher";
  result = await request("/api/auth/me", { token });
  assert.equal(result.body.user.role, "publisher");
  current.accountStatus = "disabled";
  assert.equal((await request("/api/auth/me", { token })).status, 403);
  assert.equal(find.mock.callCount(), 3);
});

for (const [field, value, expected] of [
  ["firstName", "  Ana  ", "Ana"], ["lastName", "  Pérez  ", "Pérez"],
  ["phone", " +54 (341) 123-4567 ", "+54 (341) 123-4567"],
  ["phone", null, null], ["phone", "", null], ["phone", "   ", null],
]) {
  test(`PATCH permite actualización parcial ${field}=${JSON.stringify(value)} del usuario autenticado`, async (t) => {
    const current = user();
    t.mock.method(User, "findByPk", async (userId) => { assert.equal(userId, id); return current; });
    const update = t.mock.method(current, "update", async (data, options) => {
      assert.deepEqual(data, { [field]: expected });
      assert.deepEqual(options.fields, [field]);
      assert.equal(current.id, id);
      current.set(data);
      return current;
    });
    const result = await request("/api/users/me", { method: "PATCH", token: signAccessToken(id), body: { [field]: value } });
    assert.equal(result.status, 200);
    assert.equal(result.body.user[field], expected);
    assert.equal(update.mock.callCount(), 1);
    assertPublic(result.body);
  });
}

for (const phone of [null, "", "   "]) {
  test(`PATCH publisher no puede limpiar teléfono con ${JSON.stringify(phone)}`, async (t) => {
    const current = user({ role: "publisher", phone: "1234567" });
    t.mock.method(User, "findByPk", async () => current);
    const update = t.mock.method(current, "update", () => assert.fail("No debe actualizar"));
    const result = await request("/api/users/me", { method: "PATCH", token: signAccessToken(id), body: { phone } });
    assert.equal(result.status, 400);
    assert.deepEqual(result.body, { error: "El teléfono es obligatorio para usuarios publicadores." });
    assert.equal(update.mock.callCount(), 0);
  });
}

for (const field of ["email", "role", "accountStatus", "passwordHash", "password", "id", "userId", "createdAt", "updatedAt", "publisherType", "taxId", "agencyName"]) {
  test(`PATCH rechaza ${field}`, async (t) => {
    const current = user();
    t.mock.method(User, "findByPk", async () => current);
    const update = t.mock.method(current, "update", () => assert.fail("No debe actualizar"));
    const result = await request("/api/users/me", { method: "PATCH", token: signAccessToken(id), body: { firstName: "Ana", [field]: "DO_NOT_EXPOSE" } });
    assert.equal(result.status, 400);
    assert.equal(update.mock.callCount(), 0);
    assert.ok(!JSON.stringify(result.body).includes("DO_NOT_EXPOSE"));
  });
}

test("PATCH requiere autenticación y rechaza body vacío", async (t) => {
  assert.equal((await request("/api/users/me", { method: "PATCH", body: {} })).status, 401);
  const current = user();
  t.mock.method(User, "findByPk", async () => current);
  const update = t.mock.method(current, "update", () => assert.fail("No debe actualizar"));
  assert.equal((await request("/api/users/me", { method: "PATCH", token: signAccessToken(id), body: {} })).status, 400);
  assert.equal(update.mock.callCount(), 0);
});

test("errores inesperados de autenticación y actualización conservan el 500 seguro", async (t) => {
  const current = user();
  let failLookup = true;
  t.mock.method(User, "findByPk", async () => {
    if (failLookup) throw new Error("DO_NOT_EXPOSE database-host password=secret");
    return current;
  });
  const token = signAccessToken(id);
  let result = await request("/api/auth/me", { token });
  assert.equal(result.status, 500);
  assert.deepEqual(result.body, { error: "Error interno del servidor" });
  failLookup = false;
  t.mock.method(current, "update", async () => { throw new Error("DO_NOT_EXPOSE SQL"); });
  result = await request("/api/users/me", { method: "PATCH", token, body: { firstName: "Ana" } });
  assert.equal(result.status, 500);
  assert.deepEqual(result.body, { error: "Error interno del servidor" });
});

test("health permanece 200 y las rutas inexistentes siguen respondiendo 404 JSON", async () => {
  const health = await request("/api/health");
  assert.equal(health.status, 200);
  assert.equal(health.body.service, "inmuconnect-back");
  for (const path of ["/missing", "/api/usuarios", "/api/publicaciones"]) {
    const result = await request(path);
    assert.equal(result.status, 404);
    assert.deepEqual(result.body, { error: "Recurso no encontrado" });
  }
});
