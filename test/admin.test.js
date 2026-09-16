import "../test-support/environment.js";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { test } from "node:test";
import { Op } from "sequelize";
import app from "../src/app.js";
import sequelize from "../src/config/database.js";
import { validateData } from "../src/middlewares/validate.js";
import {
  Amenity,
  City,
  Consultation,
  Property,
  PropertyAmenity,
  PropertyChangeHistory,
  PropertyImage,
  PropertyService,
  PropertyView,
  Service,
  User,
} from "../src/models/index.js";
import { getAdminMetrics } from "../src/modules/admin/adminMetric.service.js";
import {
  deleteAdminProperty,
  getAdminPropertyHistory,
  listAdminProperties,
  pauseAdminProperty,
  reactivateAdminProperty,
  updateAdminProperty,
} from "../src/modules/admin/adminProperty.service.js";
import {
  adminPropertyListSchema,
  adminUpdatePropertySchema,
} from "../src/modules/admin/adminProperty.validation.js";
import {
  disableAdminUser,
  listAdminUsers,
  reactivateAdminUser,
  updateAdminUser,
} from "../src/modules/admin/adminUser.service.js";
import {
  adminUpdateUserSchema,
  adminUserListSchema,
} from "../src/modules/admin/adminUser.validation.js";
import { signAccessToken } from "../src/utils/jwt.js";

const adminId = "97b55e08-ac69-48de-b8f4-032fc8695c33";
const publisherId = "15b5bc88-1a5c-4f61-86eb-f8c56fb70e30";
const interestedId = "2a85729c-24f1-4f01-b142-62e15ffb2a74";
const propertyId = "d6763e39-4461-4a23-80c9-e8f913c10f20";
const cityId = "dcaa991f-2f83-4273-a4ea-61f0361c52fb";
const provinceId = "8f891fa6-c31a-4082-b32f-e2d306d19a9d";

function user(overrides = {}) {
  const value = {
    id: interestedId,
    firstName: "Ana",
    lastName: "Pérez",
    email: "ana@example.com",
    phone: "+54 9 11 1234-5678",
    role: "interested",
    accountStatus: "active",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
  value.update = async (changes) => Object.assign(value, changes, { updatedAt: new Date() });
  return value;
}

function property(overrides = {}) {
  const value = {
    id: propertyId,
    publisherId,
    title: "Casa céntrica",
    description: "Descripción",
    operationType: "sale",
    propertyType: "house",
    price: "100000.00",
    currency: "USD",
    cityId,
    street: "Mitre",
    streetNumber: "100",
    totalArea: "100.00",
    rooms: 4,
    bedrooms: 3,
    bathrooms: 2,
    age: 5,
    propertyCondition: "good",
    acceptsPets: true,
    garage: 1,
    expenses: null,
    taxes: null,
    commissions: null,
    publicationStatus: "active",
    latitude: null,
    longitude: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    city: city(),
    images: [],
    services: [],
    amenities: [],
    ...overrides,
  };
  value.update = async (changes) => Object.assign(value, changes, { updatedAt: new Date() });
  return value;
}

function city() {
  return {
    id: cityId,
    name: "Trenque Lauquen",
    provinceId,
    province: { id: provinceId, name: "Buenos Aires" },
  };
}

function managedTransaction(t) {
  const transaction = { LOCK: { UPDATE: "UPDATE" } };
  t.mock.method(sequelize, "transaction", async (callback) => callback(transaction));
  return transaction;
}

function mockPropertyOperation(t, status = "active") {
  const transaction = managedTransaction(t);
  const record = property({ publicationStatus: status });
  t.mock.method(Property, "findByPk", async () => ({ id: propertyId, publisherId }));
  t.mock.method(Property, "findOne", async () => record);
  t.mock.method(City, "findByPk", async () => city());
  t.mock.method(PropertyImage, "findAll", async () => []);
  t.mock.method(PropertyService, "findAll", async () => []);
  t.mock.method(PropertyAmenity, "findAll", async () => []);
  t.mock.method(Service, "findAll", async () => []);
  t.mock.method(Amenity, "findAll", async () => []);
  const history = t.mock.method(PropertyChangeHistory, "create", async () => ({}));
  return { transaction, record, history };
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

async function request(baseUrl, path, token) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return { status: response.status, body: await response.json() };
}

test("listado admin busca usuarios y excluye siempre las cuentas admin", async (t) => {
  const find = t.mock.method(User, "findAndCountAll", async () => ({ count: 1, rows: [user()] }));
  const filters = validateData(adminUserListSchema, { q: "ana", page: 2, limit: 10 });
  const result = await listAdminUsers(filters);
  const options = find.mock.calls[0].arguments[0];
  assert.deepEqual(options.where.role[Op.in], ["interested", "publisher"]);
  assert.equal(options.where[Op.or].length, 3);
  assert.equal(options.where[Op.or][0].firstName[Op.iLike], "%ana%");
  assert.equal(options.offset, 10);
  assert.equal(result.users[0].email, "ana@example.com");
  assert.deepEqual(result.pagination, { page: 2, limit: 10, total: 1, totalPages: 1 });
});

test("filtros de usuarios aceptan sólo roles y estados administrables", () => {
  assert.equal(validateData(adminUserListSchema, { role: "publisher" }).role, "publisher");
  assert.equal(validateData(adminUserListSchema, { status: "disabled" }).status, "disabled");
  assert.throws(() => validateData(adminUserListSchema, { role: "admin" }), { statusCode: 400 });
  assert.throws(() => validateData(adminUserListSchema, { status: "deleted" }), { statusCode: 400 });
});

test("admin edita únicamente datos básicos sin aceptar rol, password ni email", async (t) => {
  const record = user();
  t.mock.method(User, "findOne", async () => record);
  const input = validateData(adminUpdateUserSchema, { firstName: "  María  ", phone: null });
  const result = await updateAdminUser(interestedId, input);
  assert.equal(result.firstName, "María");
  assert.equal(result.phone, null);
  for (const field of ["role", "password", "passwordHash", "email", "accountStatus", "id"]) {
    assert.throws(() => validateData(adminUpdateUserSchema, { [field]: "DO_NOT_EXPOSE" }), { statusCode: 400 });
  }
});

test("disable y reactivate son idempotentes y no operan sobre administradores", async (t) => {
  let record = user();
  const find = t.mock.method(User, "findOne", async () => record);
  assert.equal((await disableAdminUser(interestedId)).accountStatus, "disabled");
  assert.equal((await disableAdminUser(interestedId)).accountStatus, "disabled");
  assert.equal((await reactivateAdminUser(interestedId)).accountStatus, "active");
  assert.equal(find.mock.calls[0].arguments[0].where.role[Op.ne], "admin");
  record = null;
  await assert.rejects(disableAdminUser(adminId), {
    statusCode: 404,
    message: "Usuario no encontrado.",
  });
});

test("publisher no puede quedar sin teléfono mediante edición admin", async (t) => {
  t.mock.method(User, "findOne", async () => user({ id: publisherId, role: "publisher" }));
  await assert.rejects(updateAdminUser(publisherId, { phone: null }), {
    statusCode: 400,
    message: "El teléfono es obligatorio para usuarios publicadores.",
  });
});

test("listado admin de propiedades aplica estado, publisher, búsqueda y paginación", async (t) => {
  const find = t.mock.method(Property, "findAndCountAll", async () => ({ count: 1, rows: [property()] }));
  const filters = validateData(adminPropertyListSchema, {
    status: "paused", publisherId, q: "casa", page: 2, limit: 5,
  });
  const result = await listAdminProperties(filters);
  const options = find.mock.calls[0].arguments[0];
  assert.equal(options.where.publicationStatus, "paused");
  assert.equal(options.where.publisherId, publisherId);
  assert.equal(options.where[Op.or][0].title[Op.iLike], "%casa%");
  assert.equal(options.distinct, true);
  assert.equal(options.offset, 5);
  assert.equal(result.properties[0].publisherId, publisherId);
});

test("PATCH admin prohíbe imágenes y campos controlados", () => {
  assert.equal(validateData(adminUpdatePropertySchema, { title: "Nuevo título" }).title, "Nuevo título");
  for (const body of [
    { images: ["https://example.test/one.jpg", "https://example.test/two.jpg"] },
    { publisherId },
    { publicationStatus: "paused" },
    { id: propertyId },
    { createdAt: new Date().toISOString() },
    { updatedAt: new Date().toISOString() },
    {},
  ]) assert.throws(() => validateData(adminUpdatePropertySchema, body), { statusCode: 400 });
});

test("edición admin conserva imágenes y registra changedBy del administrador", async (t) => {
  const { record, history } = mockPropertyOperation(t);
  const imageDestroy = t.mock.method(PropertyImage, "destroy", () => assert.fail("No debe reemplazar imágenes"));
  const result = await updateAdminProperty(propertyId, adminId, { title: "Título moderado" });
  assert.equal(record.title, "Título moderado");
  assert.equal(result.title, "Título moderado");
  assert.equal(history.mock.calls[0].arguments[0].changedBy, adminId);
  assert.equal(history.mock.calls[0].arguments[0].action, "updated");
  assert.equal(imageDestroy.mock.callCount(), 0);
});

test("admin pausa, reactiva y elimina lógicamente con changedBy admin", async (t) => {
  let operation = mockPropertyOperation(t, "active");
  assert.equal((await pauseAdminProperty(propertyId, adminId)).publicationStatus, "paused");
  assert.equal(operation.history.mock.calls[0].arguments[0].action, "paused");
  assert.equal(operation.history.mock.calls[0].arguments[0].changedBy, adminId);

  t.mock.restoreAll();
  operation = mockPropertyOperation(t, "paused");
  assert.equal((await reactivateAdminProperty(propertyId, adminId)).publicationStatus, "active");
  assert.equal(operation.history.mock.calls[0].arguments[0].action, "reactivated");
  assert.equal(operation.history.mock.calls[0].arguments[0].changedBy, adminId);

  t.mock.restoreAll();
  operation = mockPropertyOperation(t, "active");
  const destroy = t.mock.method(Property, "destroy", () => assert.fail("DELETE debe ser lógico"));
  assert.equal((await deleteAdminProperty(propertyId, adminId)).publicationStatus, "deleted");
  assert.equal(operation.history.mock.calls[0].arguments[0].action, "deleted");
  assert.equal(operation.history.mock.calls[0].arguments[0].changedBy, adminId);
  assert.equal(destroy.mock.callCount(), 0);
});

test("historial admin admite cualquier propiedad y usa serializer seguro", async (t) => {
  t.mock.method(Property, "findByPk", async () => ({ id: propertyId, publisherId }));
  t.mock.method(Property, "findOne", async () => ({ id: propertyId }));
  const findHistory = t.mock.method(PropertyChangeHistory, "findAll", async () => [{
    id: "history-id",
    action: "updated",
    previousData: { title: "Anterior" },
    newData: { title: "Nueva" },
    changedBy: adminId,
    createdAt: new Date("2026-01-02T00:00:00Z"),
  }]);
  const result = await getAdminPropertyHistory(propertyId);
  assert.equal(result[0].action, "updated");
  assert.equal(JSON.stringify(result).includes(adminId), false);
  assert.deepEqual(findHistory.mock.calls[0].arguments[0].order, [["createdAt", "DESC"]]);
});

test("métricas admin aplican definiciones de usuarios y cuentan actividad global", async (t) => {
  const userCount = t.mock.method(User, "count", async (options) =>
    options.where.role === "interested" ? 10 : 3);
  const propertyCount = t.mock.method(Property, "count", async (options) =>
    options.where.publicationStatus === "active" ? 8 : 2);
  t.mock.method(PropertyView, "count", async () => 40);
  t.mock.method(Consultation, "count", async () => 12);
  const result = await getAdminMetrics();
  assert.deepEqual(userCount.mock.calls[0].arguments[0].where, {
    role: "interested", accountStatus: "active",
  });
  assert.deepEqual(userCount.mock.calls[1].arguments[0].where, {
    role: "publisher", accountStatus: "active",
  });
  assert.equal(propertyCount.mock.callCount(), 2);
  assert.deepEqual(result, {
    registeredUsers: 10,
    publishers: 3,
    activeProperties: 8,
    pausedProperties: 2,
    totalViews: 40,
    totalConsultations: 12,
  });
});

test("todas las áreas admin exigen admin y bloquean interested/publisher", async (t) => {
  t.mock.method(User, "findByPk", async (id) => user({
    id,
    role: id === adminId ? "admin" : id === publisherId ? "publisher" : "interested",
  }));
  t.mock.method(User, "findAndCountAll", async () => ({ count: 0, rows: [] }));
  t.mock.method(Property, "findAndCountAll", async () => ({ count: 0, rows: [] }));
  t.mock.method(User, "count", async () => 0);
  t.mock.method(Property, "count", async () => 0);
  t.mock.method(PropertyView, "count", async () => 0);
  t.mock.method(Consultation, "count", async () => 0);

  await withServer(async (baseUrl) => {
    for (const path of ["/api/admin/users", "/api/admin/properties", "/api/admin/metrics"]) {
      assert.equal((await request(baseUrl, path)).status, 401);
      assert.equal((await request(baseUrl, path, signAccessToken(interestedId))).status, 403);
      assert.equal((await request(baseUrl, path, signAccessToken(publisherId))).status, 403);
      assert.equal((await request(baseUrl, path, signAccessToken(adminId))).status, 200);
    }
  });
});
