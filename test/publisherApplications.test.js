import "../test-support/environment.js";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { mock, test } from "node:test";
import { Op, Sequelize, UniqueConstraintError } from "sequelize";
import app from "../src/app.js";
import sequelize from "../src/config/database.js";
import { User, PublisherApplication, PublisherProfile, Notification } from "../src/models/index.js";
import {
  approveApplication,
  createApplication,
  getMyLatestApplication,
  listApplications,
  registerPublicApplication,
  rejectApplication,
} from "../src/modules/publishers/publisherApplication.service.js";
import { signAccessToken, verifyAccessToken } from "../src/utils/jwt.js";

const userId = "c54acdd0-348d-4f26-86d9-0e8da651c7b2";
const adminId = "97b55e08-ac69-48de-b8f4-032fc8695c33";
const applicationId = "d42e9270-c765-43ce-b268-f4c4f87c7b09";
const password = "test-password";
const publicBody = {
  firstName: "  María  ", lastName: "  Pérez  ", email: "  MARIA@EXAMPLE.COM ",
  phone: "+54 (341) 123-4567", password, passwordConfirm: password,
  publisherType: "individual", taxId: "20-12345678-9", agencyName: "",
};
const applicationBody = {
  publisherType: "agency", taxId: "30-12345678-0",
  agencyName: "  Inmobiliaria Centro  ", phone: "+54 341 555 1212",
};

function buildUser(overrides = {}) {
  return User.unscoped().build({
    id: userId, firstName: "María", lastName: "Pérez", email: "maria@example.com",
    phone: null, passwordHash: "DO_NOT_EXPOSE", role: "interested", accountStatus: "active",
    createdAt: new Date("2026-01-01T00:00:00Z"), updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  });
}

function buildApplication(overrides = {}) {
  return PublisherApplication.build({
    id: applicationId, userId, publisherType: "individual", taxId: "20123456789",
    agencyName: null, phone: "+54 341 555 1212", status: "pending",
    reviewedAt: null, reviewedBy: null, rejectionReason: null,
    createdAt: new Date("2026-01-02T00:00:00Z"), updatedAt: new Date("2026-01-02T00:00:00Z"),
    ...overrides,
  });
}

function managedTransaction(t) {
  const transaction = { LOCK: { UPDATE: "UPDATE" } };
  const state = { commits: 0, rollbacks: 0 };
  t.mock.method(sequelize, "transaction", async (callback) => {
    try {
      const result = await callback(transaction);
      state.commits++;
      return result;
    } catch (error) {
      state.rollbacks++;
      throw error;
    }
  });
  return { transaction, state };
}

function noActiveApplications(t) {
  return t.mock.method(PublisherApplication, "findOne", async () => null);
}

function assertPublic(result) {
  const serialized = JSON.stringify(result);
  assert.ok(!serialized.includes("passwordHash"));
  assert.ok(!serialized.includes("DO_NOT_EXPOSE"));
}

async function withServer(callback) {
  const server = createServer(app);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    return await callback(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

async function http(baseUrl, path, { method = "GET", body, token, headers = {} } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  return { status: response.status, body: await response.json() };
}

test("registro público crea User interested y solicitud pending en la misma transacción", async (t) => {
  const { transaction, state } = managedTransaction(t);
  const userFind = t.mock.method(User, "findOne", async () => null);
  let userValues;
  const userCreate = t.mock.method(User, "create", async (values, options) => {
    userValues = values;
    assert.equal(options.transaction, transaction);
    return buildUser(values);
  });
  const applicationFind = noActiveApplications(t);
  let applicationValues;
  const applicationCreate = t.mock.method(PublisherApplication, "create", async (values, options) => {
    applicationValues = values;
    assert.equal(options.transaction, transaction);
    return buildApplication(values);
  });
  const profileCreate = t.mock.method(PublisherProfile, "create", () => assert.fail("No debe crear perfil"));

  const result = await registerPublicApplication(publicBody);
  assert.equal(state.commits, 1);
  assert.equal(state.rollbacks, 0);
  assert.equal(userFind.mock.calls[0].arguments[0].transaction, transaction);
  assert.equal(userCreate.mock.callCount(), 1);
  assert.equal(userValues.email, "maria@example.com");
  assert.equal(userValues.role, "interested");
  assert.equal(userValues.accountStatus, "active");
  assert.equal(applicationFind.mock.callCount(), 2);
  for (const call of applicationFind.mock.calls) assert.equal(call.arguments[0].transaction, transaction);
  assert.deepEqual(applicationValues, {
    userId, publisherType: "individual", taxId: "20123456789", agencyName: null,
    phone: "+54 (341) 123-4567", status: "pending",
  });
  assert.equal(profileCreate.mock.callCount(), 0);
  assert.equal(result.user.role, "interested");
  assert.equal(result.application.status, "pending");
  assert.equal(verifyAccessToken(result.token).sub, userId);
  assertPublic(result);
});

test("JWT público se genera únicamente después del commit", async (t) => {
  let committed = false;
  const transaction = { LOCK: { UPDATE: "UPDATE" } };
  t.mock.method(sequelize, "transaction", async (callback) => {
    const result = await callback(transaction);
    committed = true;
    return result;
  });
  t.mock.method(User, "findOne", async () => null);
  t.mock.method(User, "create", async (values) => buildUser(values));
  noActiveApplications(t);
  t.mock.method(PublisherApplication, "create", async (values) => buildApplication(values));
  const originalSign = JSON.stringify;
  // El resultado sólo puede contener token una vez resuelta la transacción administrada.
  const result = await registerPublicApplication(publicBody);
  assert.equal(committed, true);
  assert.equal(typeof result.token, "string");
  assert.equal(JSON.stringify, originalSign);
});

test("fallo de solicitud pública revierte la transacción que contiene la creación de User", async (t) => {
  const { transaction, state } = managedTransaction(t);
  t.mock.method(User, "findOne", async () => null);
  const userCreate = t.mock.method(User, "create", async (values, options) => {
    assert.equal(options.transaction, transaction);
    return buildUser(values);
  });
  noActiveApplications(t);
  t.mock.method(PublisherApplication, "create", async () => { throw new Error("DO_NOT_EXPOSE"); });
  await assert.rejects(registerPublicApplication(publicBody), /DO_NOT_EXPOSE/);
  assert.equal(userCreate.mock.callCount(), 1);
  assert.equal(state.commits, 0);
  assert.equal(state.rollbacks, 1);
});

test("correo existente en registro público devuelve conflicto orientado a iniciar sesión", async (t) => {
  const { state } = managedTransaction(t);
  t.mock.method(User, "findOne", async () => buildUser());
  const applicationCreate = t.mock.method(PublisherApplication, "create", () => assert.fail("No debe crear"));
  await assert.rejects(registerPublicApplication(publicBody), {
    statusCode: 409,
    message: "El correo electrónico ya está registrado. Iniciá sesión para continuar.",
  });
  assert.equal(applicationCreate.mock.callCount(), 0);
  assert.equal(state.rollbacks, 1);
});

test("colisión concurrente de email en registro público conserva el mensaje para iniciar sesión", async (t) => {
  const { state } = managedTransaction(t);
  t.mock.method(User, "findOne", async () => null);
  t.mock.method(User, "create", async () => {
    throw new UniqueConstraintError({ parent: { constraint: "users_email_unique" } });
  });
  const applicationCreate = t.mock.method(PublisherApplication, "create", () => assert.fail("No debe crear"));
  await assert.rejects(registerPublicApplication(publicBody), {
    statusCode: 409,
    message: "El correo electrónico ya está registrado. Iniciá sesión para continuar.",
  });
  assert.equal(applicationCreate.mock.callCount(), 0);
  assert.equal(state.rollbacks, 1);
});

test("CUIT activo en registro público revierte el usuario y devuelve 409", async (t) => {
  const { state } = managedTransaction(t);
  t.mock.method(User, "findOne", async () => null);
  t.mock.method(User, "create", async (values) => buildUser(values));
  let call = 0;
  t.mock.method(PublisherApplication, "findOne", async () => ++call === 2 ? buildApplication() : null);
  const applicationCreate = t.mock.method(PublisherApplication, "create", () => assert.fail("No debe crear"));
  await assert.rejects(registerPublicApplication(publicBody), {
    statusCode: 409, message: "El CUIT/CUIL ya está asociado a una solicitud activa.",
  });
  assert.equal(applicationCreate.mock.callCount(), 0);
  assert.equal(state.rollbacks, 1);
});

test("solicitud autenticada usa req.user, normaliza CUIT y permite volver tras rechazo", async (t) => {
  const { transaction, state } = managedTransaction(t);
  const currentUser = buildUser();
  const find = noActiveApplications(t);
  let values;
  t.mock.method(PublisherApplication, "create", async (data, options) => {
    values = data;
    assert.equal(options.transaction, transaction);
    return buildApplication(data);
  });
  const profileCreate = t.mock.method(PublisherProfile, "create", () => assert.fail("No debe crear perfil"));
  const result = await createApplication(currentUser, applicationBody);
  assert.equal(state.commits, 1);
  assert.equal(currentUser.role, "interested");
  assert.equal(profileCreate.mock.callCount(), 0);
  assert.equal(values.userId, userId);
  assert.equal(values.taxId, "30123456780");
  assert.equal(values.agencyName, "Inmobiliaria Centro");
  assert.equal(values.status, "pending");
  assert.equal(find.mock.callCount(), 2);
  const statuses = find.mock.calls[0].arguments[0].where.status[Op.in];
  assert.deepEqual(statuses, ["pending", "approved"]);
  assert.equal(result.status, "pending");
});

for (const [role, status, message] of [
  ["publisher", 409, "La cuenta ya está habilitada como publicador."],
  ["admin", 403, "La cuenta no puede solicitar ser publicador."],
]) {
  test(`${role} no puede crear una solicitud`, async (t) => {
    const transaction = t.mock.method(sequelize, "transaction", () => assert.fail("No debe abrir transacción"));
    await assert.rejects(createApplication(buildUser({ role }), applicationBody), { statusCode: status, message });
    assert.equal(transaction.mock.callCount(), 0);
  });
}

for (const [kind, first, message] of [
  ["usuario", buildApplication(), "Ya existe una solicitud activa para esta cuenta."],
  ["CUIT", null, "El CUIT/CUIL ya está asociado a una solicitud activa."],
]) {
  test(`solicitud autenticada bloquea conflicto activo por ${kind}`, async (t) => {
    const { state } = managedTransaction(t);
    let call = 0;
    t.mock.method(PublisherApplication, "findOne", async () => ++call === 1 ? first : buildApplication());
    const create = t.mock.method(PublisherApplication, "create", () => assert.fail("No debe crear"));
    await assert.rejects(createApplication(buildUser(), applicationBody), { statusCode: 409, message });
    assert.equal(create.mock.callCount(), 0);
    assert.equal(state.rollbacks, 1);
  });
}

for (const [constraint, message] of [
  ["publisher_applications_user_open_unique", "Ya existe una solicitud activa para esta cuenta."],
  ["publisher_applications_tax_id_open_unique", "El CUIT/CUIL ya está asociado a una solicitud activa."],
]) {
  test(`índice parcial ${constraint} se convierte en 409 seguro`, async (t) => {
    managedTransaction(t);
    noActiveApplications(t);
    t.mock.method(PublisherApplication, "create", async () => {
      throw new UniqueConstraintError({ parent: { constraint, detail: "DO_NOT_EXPOSE" } });
    });
    await assert.rejects(createApplication(buildUser(), applicationBody), { statusCode: 409, message });
  });
}

test("me devuelve null o la solicitud más reciente", async (t) => {
  let current = null;
  const find = t.mock.method(PublisherApplication, "findOne", async () => current);
  assert.equal(await getMyLatestApplication(userId), null);
  current = buildApplication({ status: "rejected" });
  assert.equal((await getMyLatestApplication(userId)).status, "rejected");
  for (const call of find.mock.calls) {
    assert.deepEqual(call.arguments[0].where, { userId });
    assert.deepEqual(call.arguments[0].order, [["createdAt", "DESC"]]);
  }
});

test("listado admin filtra y ordena, con atributos públicos explícitos", async (t) => {
  const application = buildApplication();
  application.applicant = buildUser();
  const find = t.mock.method(PublisherApplication, "findAll", async () => [application]);
  const result = await listApplications("approved");
  const options = find.mock.calls[0].arguments[0];
  assert.deepEqual(options.where, { status: "approved" });
  assert.deepEqual(options.order, [["createdAt", "ASC"]]);
  assert.equal(options.include[0].association, "applicant");
  assert.ok(!options.include[0].attributes.includes("passwordHash"));
  assert.equal(result[0].applicant.email, "maria@example.com");
  assertPublic(result);
});

test("aprobar bloquea filas y actualiza usuario, perfil, solicitud y notificación en una transacción", async (t) => {
  const { transaction, state } = managedTransaction(t);
  const application = buildApplication();
  const applicant = buildUser();
  const applicationFind = t.mock.method(PublisherApplication, "findByPk", async (id, options) => {
    assert.equal(id, applicationId);
    assert.equal(options.transaction, transaction);
    assert.equal(options.lock, "UPDATE");
    return application;
  });
  const userFind = t.mock.method(User, "findByPk", async (id, options) => {
    assert.equal(id, userId);
    assert.equal(options.transaction, transaction);
    assert.equal(options.lock, "UPDATE");
    return applicant;
  });
  const userUpdate = t.mock.method(applicant, "update", async (values, options) => {
    assert.deepEqual(values, { phone: application.phone, role: "publisher" });
    assert.equal(options.transaction, transaction);
    applicant.set(values);
  });
  let profile;
  const profileCreate = t.mock.method(PublisherProfile, "create", async (values, options) => {
    profile = values;
    assert.equal(options.transaction, transaction);
  });
  const applicationUpdate = t.mock.method(application, "update", async (values, options) => {
    assert.equal(options.transaction, transaction);
    application.set(values);
  });
  let notification;
  const notificationCreate = t.mock.method(Notification, "create", async (values, options) => {
    notification = values;
    assert.equal(options.transaction, transaction);
  });

  const result = await approveApplication(applicationId, adminId);
  assert.equal(state.commits, 1);
  assert.equal(applicationFind.mock.callCount(), 1);
  assert.equal(userFind.mock.callCount(), 1);
  assert.equal(userUpdate.mock.callCount(), 1);
  assert.equal(profileCreate.mock.callCount(), 1);
  assert.deepEqual(profile, {
    userId, publisherType: "individual", taxId: "20123456789", agencyName: null,
  });
  assert.equal(applicationUpdate.mock.callCount(), 1);
  assert.equal(application.status, "approved");
  assert.equal(application.reviewedBy, adminId);
  assert.ok(application.reviewedAt instanceof Date);
  assert.equal(application.rejectionReason, null);
  assert.equal(notificationCreate.mock.callCount(), 1);
  assert.deepEqual(notification, {
    userId, type: "publisher_approved", title: "Solicitud de publicación aprobada",
    message: "Tu cuenta ya está habilitada para publicar propiedades.",
    publisherApplicationId: applicationId,
  });
  assert.equal(result.status, "approved");
  assertPublic(result);
});

test("aprobar inexistente devuelve 404 y una solicitud resuelta devuelve 409 bajo lock", async (t) => {
  const { transaction, state } = managedTransaction(t);
  let current = null;
  const find = t.mock.method(PublisherApplication, "findByPk", async (_, options) => {
    assert.equal(options.lock, transaction.LOCK.UPDATE);
    return current;
  });
  await assert.rejects(approveApplication(applicationId, adminId), { statusCode: 404 });
  current = buildApplication({ status: "approved" });
  await assert.rejects(approveApplication(applicationId, adminId), {
    statusCode: 409, message: "La solicitud ya fue resuelta.",
  });
  assert.equal(find.mock.callCount(), 2);
  assert.equal(state.rollbacks, 2);
});

test("fallo durante aprobación revierte todo el callback administrado", async (t) => {
  const { state } = managedTransaction(t);
  const application = buildApplication();
  const applicant = buildUser();
  t.mock.method(PublisherApplication, "findByPk", async () => application);
  t.mock.method(User, "findByPk", async () => applicant);
  t.mock.method(applicant, "update", async () => {});
  t.mock.method(PublisherProfile, "create", async () => { throw new Error("DO_NOT_EXPOSE"); });
  const applicationUpdate = t.mock.method(application, "update", () => assert.fail("No debe continuar"));
  const notificationCreate = t.mock.method(Notification, "create", () => assert.fail("No debe continuar"));
  await assert.rejects(approveApplication(applicationId, adminId), /DO_NOT_EXPOSE/);
  assert.equal(applicationUpdate.mock.callCount(), 0);
  assert.equal(notificationCreate.mock.callCount(), 0);
  assert.equal(state.rollbacks, 1);
});

for (const reason of [undefined, null, "", "   ", "  Documentación incompleta  "]) {
  test(`rechazo normaliza motivo ${JSON.stringify(reason)} y sólo actualiza solicitud y notificación`, async (t) => {
    const { transaction, state } = managedTransaction(t);
    const application = buildApplication();
    const expected = typeof reason === "string" && reason.trim() ? reason.trim() : null;
    t.mock.method(PublisherApplication, "findByPk", async (_, options) => {
      assert.equal(options.lock, transaction.LOCK.UPDATE);
      return application;
    });
    const update = t.mock.method(application, "update", async (values, options) => {
      assert.equal(options.transaction, transaction);
      application.set(values);
    });
    const profileCreate = t.mock.method(PublisherProfile, "create", () => assert.fail("No debe crear perfil"));
    const userUpdate = t.mock.method(User.prototype, "update", () => assert.fail("No debe actualizar usuario"));
    let notification;
    t.mock.method(Notification, "create", async (values, options) => {
      notification = values;
      assert.equal(options.transaction, transaction);
    });
    const data = reason === undefined ? {} : { rejectionReason: reason };
    const result = await rejectApplication(applicationId, adminId, data);
    assert.equal(state.commits, 1);
    assert.equal(update.mock.callCount(), 1);
    assert.equal(application.status, "rejected");
    assert.equal(application.reviewedBy, adminId);
    assert.ok(application.reviewedAt instanceof Date);
    assert.equal(application.rejectionReason, expected);
    assert.equal(profileCreate.mock.callCount(), 0);
    assert.equal(userUpdate.mock.callCount(), 0);
    assert.deepEqual(notification, {
      userId, type: "publisher_rejected", title: "Solicitud de publicación rechazada",
      message: expected, publisherApplicationId: applicationId,
    });
    assert.equal(result.status, "rejected");
  });
}

test("rechazar una solicitud resuelta devuelve 409 y no crea notificación", async (t) => {
  const { state } = managedTransaction(t);
  t.mock.method(PublisherApplication, "findByPk", async () => buildApplication({ status: "rejected" }));
  const notification = t.mock.method(Notification, "create", () => assert.fail("No debe notificar"));
  await assert.rejects(rejectApplication(applicationId, adminId, {}), { statusCode: 409 });
  assert.equal(notification.mock.callCount(), 0);
  assert.equal(state.rollbacks, 1);
});

test("contratos HTTP protegen rutas y validan antes de persistir", async (t) => {
  const guard = t.mock.method(Sequelize.prototype, "query", () => assert.fail("No debe ejecutar SQL"));
  await withServer(async (baseUrl) => {
    const forbiddenFields = ["role", "accountStatus", "status", "reviewedBy", "reviewedAt", "userId", "id"];
    for (const [method, path, body] of [
      ...forbiddenFields.map((field) => ["POST", "/api/publisher-applications/public", {
        ...publicBody, [field]: "DO_NOT_EXPOSE",
      }]),
      ["POST", "/api/publisher-applications/public", { ...publicBody, phone: "" }],
      ["POST", "/api/publisher-applications/public", { ...publicBody, publisherType: "agency", agencyName: "" }],
      ["POST", "/api/publisher-applications/public", { ...publicBody, taxId: "20-123" }],
    ]) {
      const result = await http(baseUrl, path, { method, body });
      assert.equal(result.status, 400);
    }
    assert.equal((await http(baseUrl, "/api/publisher-applications/me")).status, 401);
    assert.equal((await http(baseUrl, "/api/publisher-applications", { method: "POST", body: applicationBody })).status, 401);
    assert.equal((await http(baseUrl, "/api/admin/publisher-applications")).status, 401);
  });
  assert.equal(guard.mock.callCount(), 0);
});

test("HTTP conecta registro público, solicitud autenticada y consulta me con los services", async (t) => {
  const transaction = { LOCK: { UPDATE: "UPDATE" } };
  t.mock.method(sequelize, "transaction", async (callback) => callback(transaction));
  const current = buildUser();
  t.mock.method(User, "findOne", async () => null);
  t.mock.method(User, "findByPk", async () => current);
  t.mock.method(User, "create", async (values) => buildUser(values));
  let latest = null;
  t.mock.method(PublisherApplication, "findOne", async (options) => {
    if (options.order) return latest;
    return null;
  });
  t.mock.method(PublisherApplication, "create", async (values) => {
    latest = buildApplication(values);
    return latest;
  });

  await withServer(async (baseUrl) => {
    let result = await http(baseUrl, "/api/publisher-applications/public", {
      method: "POST", body: publicBody,
    });
    assert.equal(result.status, 201);
    assert.equal(result.body.user.role, "interested");
    assert.equal(result.body.application.status, "pending");
    assert.equal(verifyAccessToken(result.body.token).sub, userId);
    assertPublic(result.body);

    result = await http(baseUrl, "/api/publisher-applications", {
      method: "POST", token: signAccessToken(userId), body: applicationBody,
    });
    assert.equal(result.status, 201);
    assert.equal(result.body.application.userId, userId);

    result = await http(baseUrl, "/api/publisher-applications/me", {
      token: signAccessToken(userId),
    });
    assert.equal(result.status, 200);
    assert.equal(result.body.application.id, applicationId);
    assertPublic(result.body);
  });
});

test("HTTP: interested y publisher no acceden a admin; admin lista pending por defecto y filtra", async (t) => {
  const interested = buildUser();
  let current = interested;
  t.mock.method(User, "findByPk", async () => current);
  const findAll = t.mock.method(PublisherApplication, "findAll", async () => []);
  await withServer(async (baseUrl) => {
    const token = signAccessToken(userId);
    assert.equal((await http(baseUrl, "/api/admin/publisher-applications", { token })).status, 403);
    current = buildUser({ role: "publisher" });
    assert.equal((await http(baseUrl, "/api/admin/publisher-applications", { token })).status, 403);
    current = buildUser({ id: adminId, role: "admin" });
    let result = await http(baseUrl, "/api/admin/publisher-applications", { token });
    assert.equal(result.status, 200);
    assert.deepEqual(result.body, { applications: [] });
    assert.deepEqual(findAll.mock.calls[0].arguments[0].where, { status: "pending" });
    result = await http(baseUrl, "/api/admin/publisher-applications?status=rejected", { token });
    assert.equal(result.status, 200);
    assert.deepEqual(findAll.mock.calls[1].arguments[0].where, { status: "rejected" });
    result = await http(baseUrl, "/api/admin/publisher-applications?status=invalid", { token });
    assert.equal(result.status, 400);
    assert.equal(findAll.mock.callCount(), 2);
  });
});

test("HTTP rechaza userId en solicitud autenticada antes de crear", async (t) => {
  const current = buildUser();
  t.mock.method(User, "findByPk", async () => current);
  const transaction = t.mock.method(sequelize, "transaction", () => assert.fail("No debe persistir"));
  await withServer(async (baseUrl) => {
    const result = await http(baseUrl, "/api/publisher-applications", {
      method: "POST", token: signAccessToken(userId), body: { ...applicationBody, userId: adminId },
    });
    assert.equal(result.status, 400);
  });
  assert.equal(transaction.mock.callCount(), 0);
});

test("HTTP admin toma reviewedBy de req.user y valida UUID/body", async (t) => {
  const admin = buildUser({ id: adminId, role: "admin" });
  t.mock.method(User, "findByPk", async () => admin);
  const transaction = t.mock.method(sequelize, "transaction", () => assert.fail("No debe resolver"));
  await withServer(async (baseUrl) => {
    const token = signAccessToken(adminId);
    assert.equal((await http(baseUrl, "/api/admin/publisher-applications/not-a-uuid/approve", {
      method: "PATCH", token,
    })).status, 400);
    assert.equal((await http(baseUrl, `/api/admin/publisher-applications/${applicationId}/approve`, {
      method: "PATCH", token, body: { reviewedBy: userId },
    })).status, 400);
    assert.equal((await http(baseUrl, `/api/admin/publisher-applications/${applicationId}/reject`, {
      method: "PATCH", token, body: { status: "approved" },
    })).status, 400);
  });
  assert.equal(transaction.mock.callCount(), 0);
});

test("HTTP conecta approve y reject usando exclusivamente el admin autenticado", async (t) => {
  const transaction = { LOCK: { UPDATE: "UPDATE" } };
  t.mock.method(sequelize, "transaction", async (callback) => callback(transaction));
  const admin = buildUser({ id: adminId, role: "admin" });
  const applicant = buildUser();
  t.mock.method(User, "findByPk", async (id) => id === adminId ? admin : applicant);
  let application = buildApplication();
  t.mock.method(PublisherApplication, "findByPk", async () => application);
  t.mock.method(applicant, "update", async (values) => applicant.set(values));
  t.mock.method(PublisherProfile, "create", async () => undefined);
  t.mock.method(Notification, "create", async () => undefined);

  await withServer(async (baseUrl) => {
    const token = signAccessToken(adminId);
    let update = t.mock.method(application, "update", async (values) => application.set(values));
    let result = await http(baseUrl, `/api/admin/publisher-applications/${applicationId}/approve`, {
      method: "PATCH", token,
    });
    assert.equal(result.status, 200);
    assert.equal(result.body.application.status, "approved");
    assert.equal(result.body.application.reviewedBy, adminId);
    assert.equal(update.mock.callCount(), 1);

    application = buildApplication();
    update = t.mock.method(application, "update", async (values) => application.set(values));
    result = await http(baseUrl, `/api/admin/publisher-applications/${applicationId}/reject`, {
      method: "PATCH", token,
    });
    assert.equal(result.status, 200);
    assert.equal(result.body.application.status, "rejected");
    assert.equal(result.body.application.reviewedBy, adminId);
    assert.equal(result.body.application.rejectionReason, null);
    assert.equal(update.mock.callCount(), 1);
  });
});
