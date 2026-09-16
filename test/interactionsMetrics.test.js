import "../test-support/environment.js";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { test } from "node:test";
import { Op, QueryTypes } from "sequelize";
import app from "../src/app.js";
import sequelize from "../src/config/database.js";
import { validateData } from "../src/middlewares/validate.js";
import {
  Consultation,
  Favorite,
  Notification,
  Property,
  PropertyView,
  User,
} from "../src/models/index.js";
import {
  createConsultation,
  listMyConsultations,
  listPublisherConsultations,
} from "../src/modules/consultations/consultation.service.js";
import { createConsultationSchema } from "../src/modules/consultations/consultation.validation.js";
import {
  addFavorite,
  listFavorites,
  removeFavorite,
} from "../src/modules/favorites/favorite.service.js";
import { getPublisherMetrics } from "../src/modules/metrics/publisherMetric.service.js";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../src/modules/notifications/notification.service.js";
import { listMyPropertyViews, registerPropertyView } from "../src/modules/views/propertyView.service.js";
import { signAccessToken } from "../src/utils/jwt.js";

const propertyId = "15b5bc88-1a5c-4f61-86eb-f8c56fb70e30";
const otherPropertyId = "d6763e39-4461-4a23-80c9-e8f913c10f20";
const publisherId = "dcaa991f-2f83-4273-a4ea-61f0361c52fb";
const interestedId = "2a85729c-24f1-4f01-b142-62e15ffb2a74";
const adminId = "97b55e08-ac69-48de-b8f4-032fc8695c33";
const consultationId = "8f891fa6-c31a-4082-b32f-e2d306d19a9d";
const notificationId = "a4945137-132a-49c7-8237-a795119f9be7";
const provinceId = "04338a2c-c669-4514-875e-d492619c4fc6";

const consultationInput = {
  firstName: "Ana",
  lastName: "Pérez",
  email: "ana@example.com",
  phone: "+54 9 11 1234-5678",
  message: "Quisiera coordinar una visita.",
};

function property(overrides = {}) {
  return {
    id: propertyId,
    publisherId,
    title: "Casa céntrica",
    operationType: "sale",
    propertyType: "house",
    publicationStatus: "active",
    price: "100000.00",
    currency: "USD",
    city: {
      id: "11111111-1111-4111-8111-111111111111",
      name: "Trenque Lauquen",
      province: { id: provinceId, name: "Buenos Aires" },
    },
    images: [
      { url: "https://example.test/dos.jpg", position: 1 },
      { url: "https://example.test/uno.jpg", position: 0 },
    ],
    ...overrides,
  };
}

function consultation(overrides = {}) {
  return {
    id: consultationId,
    propertyId,
    userId: null,
    ...consultationInput,
    createdAt: new Date("2026-01-02T10:00:00Z"),
    property: property(),
    ...overrides,
  };
}

function notification(overrides = {}) {
  const value = {
    id: notificationId,
    userId: publisherId,
    type: "new_consultation",
    title: "Nueva consulta recibida",
    message: "Recibiste una consulta.",
    consultationId,
    publisherApplicationId: null,
    searchAlertId: null,
    propertyId: null,
    readAt: null,
    createdAt: new Date("2026-01-02T10:00:01Z"),
    consultation: { propertyId },
    ...overrides,
  };
  value.update = async (changes) => Object.assign(value, changes);
  return value;
}

function managedTransaction(t) {
  const tx = {};
  const state = { committed: false, rolledBack: false };
  t.mock.method(sequelize, "transaction", async (callback) => {
    try {
      const result = await callback(tx);
      state.committed = true;
      return result;
    } catch (error) {
      state.rolledBack = true;
      throw error;
    }
  });
  return { tx, state };
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

async function request(baseUrl, path, { method = "GET", token, body } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  return { status: response.status, body: response.status === 204 ? null : await response.json() };
}

test("consulta anónima crea Consultation y Notification en la misma transacción", async (t) => {
  const { tx, state } = managedTransaction(t);
  t.mock.method(Property, "findOne", async () => property());
  const create = t.mock.method(Consultation, "create", async (values, options) => {
    assert.equal(values.userId, null);
    assert.equal(options.transaction, tx);
    return consultation(values);
  });
  const notify = t.mock.method(Notification, "create", async (values, options) => {
    assert.equal(options.transaction, tx);
    assert.equal(values.userId, publisherId);
    assert.equal(values.type, "new_consultation");
    assert.equal(values.consultationId, consultationId);
    assert.equal(Object.hasOwn(values, "propertyId"), false);
  });
  const result = await createConsultation(propertyId, null, consultationInput);
  assert.equal(result.id, consultationId);
  assert.equal(Object.hasOwn(result, "userId"), false);
  assert.equal(create.mock.callCount(), 1);
  assert.equal(notify.mock.callCount(), 1);
  assert.equal(state.committed, true);
});

test("consulta autenticada asocia exclusivamente el userId recibido del middleware", async (t) => {
  managedTransaction(t);
  t.mock.method(Property, "findOne", async () => property());
  let values;
  t.mock.method(Consultation, "create", async (input) => {
    values = input;
    return consultation(input);
  });
  t.mock.method(Notification, "create", async () => ({}));
  await createConsultation(propertyId, interestedId, consultationInput);
  assert.equal(values.userId, interestedId);
});

test("fallo al crear Notification revierte la transacción de la consulta", async (t) => {
  const { state } = managedTransaction(t);
  t.mock.method(Property, "findOne", async () => property());
  t.mock.method(Consultation, "create", async (values) => consultation(values));
  t.mock.method(Notification, "create", async () => { throw new Error("DO_NOT_EXPOSE"); });
  await assert.rejects(createConsultation(propertyId, null, consultationInput), /DO_NOT_EXPOSE/);
  assert.equal(state.committed, false);
  assert.equal(state.rolledBack, true);
});

test("consulta rechaza inexistente, paused, deleted y land con 404 uniforme", async (t) => {
  const { state } = managedTransaction(t);
  const find = t.mock.method(Property, "findOne", async () => null);
  const create = t.mock.method(Consultation, "create", () => assert.fail("No debe crear"));
  for (const status of ["inexistente", "paused", "deleted", "land"]) {
    await assert.rejects(createConsultation(propertyId, null, consultationInput), {
      statusCode: 404,
      message: "Propiedad no encontrada.",
    }, status);
  }
  const where = find.mock.calls[0].arguments[0].where;
  assert.equal(where.publicationStatus, "active");
  assert.equal(where.propertyType[Op.ne], "land");
  assert.equal(create.mock.callCount(), 0);
  assert.equal(state.rolledBack, true);
});

test("validación de consulta normaliza y rechaza campos inválidos", () => {
  const valid = validateData(createConsultationSchema, {
    ...consultationInput,
    email: "  ANA@EXAMPLE.COM ",
    message: "  Mensaje  ",
  });
  assert.equal(valid.email, "ana@example.com");
  assert.equal(valid.message, "Mensaje");
  for (const body of [
    { ...consultationInput, firstName: "A" },
    { ...consultationInput, lastName: "B" },
    { ...consultationInput, email: "invalido" },
    { ...consultationInput, phone: "   " },
    { ...consultationInput, message: "   " },
    { ...consultationInput, userId: interestedId },
  ]) assert.throws(() => validateData(createConsultationSchema, body), { statusCode: 400 });
});

test("historial del usuario filtra por userId, ordena y serializa la propiedad mínima", async (t) => {
  const find = t.mock.method(Consultation, "findAll", async () => [consultation()]);
  const result = await listMyConsultations(interestedId);
  assert.deepEqual(find.mock.calls[0].arguments[0].where, { userId: interestedId });
  assert.deepEqual(find.mock.calls[0].arguments[0].order, [["createdAt", "DESC"]]);
  assert.equal(result[0].property.title, "Casa céntrica");
  assert.deepEqual(result[0].property.images, ["https://example.test/uno.jpg", "https://example.test/dos.jpg"]);
  assert.equal(JSON.stringify(result).includes("publisherId"), false);
});

test("publisher recibe sólo consultas de propiedades propias y filtro ajeno devuelve 404", async (t) => {
  const propertyFind = t.mock.method(Property, "findOne", async (options) =>
    options.where.id === propertyId ? { id: propertyId } : null);
  const consultationFind = t.mock.method(Consultation, "findAll", async () => [consultation()]);
  const result = await listPublisherConsultations(publisherId, propertyId);
  const include = consultationFind.mock.calls[0].arguments[0].include[0];
  assert.equal(include.where.publisherId, publisherId);
  assert.equal(result[0].email, consultationInput.email);
  await assert.rejects(listPublisherConsultations(publisherId, otherPropertyId), { statusCode: 404 });
  assert.equal(propertyFind.mock.callCount(), 2);
  assert.equal(consultationFind.mock.callCount(), 1);
});

test("favoritos lista sólo los propios con propiedades públicas resumidas", async (t) => {
  const find = t.mock.method(Favorite, "findAll", async () => [{
    id: "favorite-id", propertyId, createdAt: new Date(), property: property(),
  }]);
  const result = await listFavorites(interestedId);
  assert.deepEqual(find.mock.calls[0].arguments[0].where, { userId: interestedId });
  assert.equal(find.mock.calls[0].arguments[0].include[0].where.publicationStatus, "active");
  assert.equal(result[0].id, propertyId);
});

test("agregar favorito usa findOrCreate idempotente y no permite la propiedad propia", async (t) => {
  t.mock.method(Property, "findOne", async () => property());
  const findOrCreate = t.mock.method(Favorite, "findOrCreate", async () => [{}, false]);
  await addFavorite(interestedId, propertyId);
  await addFavorite(interestedId, propertyId);
  assert.equal(findOrCreate.mock.callCount(), 2);
  assert.deepEqual(findOrCreate.mock.calls[0].arguments[0].where, { userId: interestedId, propertyId });
  await assert.rejects(addFavorite(publisherId, propertyId), {
    statusCode: 400,
    message: "No podés guardar tu propia propiedad como favorita.",
  });
  assert.equal(findOrCreate.mock.callCount(), 2);
});

test("favorito rechaza propiedad inactiva o land sin crear relación", async (t) => {
  const find = t.mock.method(Property, "findOne", async () => null);
  const create = t.mock.method(Favorite, "findOrCreate", () => assert.fail("No debe crear"));
  await assert.rejects(addFavorite(interestedId, propertyId), { statusCode: 404 });
  const where = find.mock.calls[0].arguments[0].where;
  assert.equal(where.publicationStatus, "active");
  assert.equal(where.propertyType[Op.ne], "land");
  assert.equal(create.mock.callCount(), 0);
});

test("eliminar favorito es idempotente y nunca afecta favoritos ajenos", async (t) => {
  const destroy = t.mock.method(Favorite, "destroy", async () => 0);
  await removeFavorite(interestedId, propertyId);
  await removeFavorite(interestedId, propertyId);
  assert.deepEqual(destroy.mock.calls[0].arguments[0].where, { userId: interestedId, propertyId });
  assert.equal(destroy.mock.callCount(), 2);
});

test("view pública registra sólo propiedades active que no sean land", async (t) => {
  const find = t.mock.method(Property, "findOne", async () => ({ id: propertyId }));
  const create = t.mock.method(PropertyView, "create", async () => ({}));
  await registerPropertyView(propertyId);
  assert.equal(create.mock.calls[0].arguments[0].propertyId, propertyId);
  assert.equal(find.mock.calls[0].arguments[0].where.publicationStatus, "active");
  assert.equal(find.mock.calls[0].arguments[0].where.propertyType[Op.ne], "land");
});

test("view autenticada conserva el usuario y la anónima conserva null", async (t) => {
  t.mock.method(Property, "findOne", async () => property());
  const create = t.mock.method(PropertyView, "create", async (values) => values);
  await registerPropertyView(propertyId);
  await registerPropertyView(propertyId, interestedId);
  assert.deepEqual(create.mock.calls[0].arguments[0], { propertyId, userId: null });
  assert.deepEqual(create.mock.calls[1].arguments[0], { propertyId, userId: interestedId });
});

test("historial de vistas agrupa por propiedad, usa la fecha más reciente y pagina", async (t) => {
  const query = t.mock.method(sequelize, "query", async (sql) => sql.includes("COUNT(DISTINCT")
    ? [{ total: 1 }]
    : [{ propertyId, lastViewedAt: "2026-01-02T10:00:00.000Z" }]);
  t.mock.method(Property, "findOne", async () => property({ services: [], amenities: [] }));
  const result = await listMyPropertyViews(interestedId, { page: 1, limit: 12 });
  assert.equal(result.history.length, 1);
  assert.equal(result.history[0].property.id, propertyId);
  assert.equal(result.history[0].lastViewedAt, "2026-01-02T10:00:00.000Z");
  assert.deepEqual(result.pagination, { page: 1, limit: 12, total: 1, totalPages: 1 });
  assert.equal(query.mock.callCount(), 2);
});

test("view no registra paused, deleted, land o inexistente", async (t) => {
  t.mock.method(Property, "findOne", async () => null);
  const create = t.mock.method(PropertyView, "create", () => assert.fail("No debe crear"));
  await assert.rejects(registerPropertyView(propertyId), { statusCode: 404 });
  assert.equal(create.mock.callCount(), 0);
});

test("métricas agregan sólo propiedades propias activas/pausadas y determinan mostViewed", async (t) => {
  const query = t.mock.method(sequelize, "query", async () => [
    { propertyId, title: "Casa", publicationStatus: "active", views: 8, consultations: 3 },
    { propertyId: otherPropertyId, title: "Local", publicationStatus: "paused", views: 2, consultations: 4 },
  ]);
  const result = await getPublisherMetrics(publisherId);
  const [sql, options] = query.mock.calls[0].arguments;
  assert.match(sql, /COUNT\(DISTINCT pv\.id\)/);
  assert.match(sql, /COUNT\(DISTINCT c\.id\)/);
  assert.match(sql, /publication_status IN \('active', 'paused'\)/);
  assert.deepEqual(options.replacements, { publisherId });
  assert.equal(options.type, QueryTypes.SELECT);
  assert.deepEqual(result.summary, {
    activeProperties: 1, pausedProperties: 1, totalViews: 10, totalConsultations: 7,
  });
  assert.deepEqual(result.mostViewed, { propertyId, title: "Casa", views: 8 });
});

test("métricas sin propiedades devuelve ceros y mostViewed null", async (t) => {
  t.mock.method(sequelize, "query", async () => []);
  const result = await getPublisherMetrics(publisherId);
  assert.deepEqual(result.summary, {
    activeProperties: 0, pausedProperties: 0, totalViews: 0, totalConsultations: 0,
  });
  assert.equal(result.mostViewed, null);
  assert.deepEqual(result.properties, []);
});

test("notificaciones lista sólo propias, ordena y calcula unreadCount", async (t) => {
  const find = t.mock.method(Notification, "findAll", async () => [notification()]);
  const count = t.mock.method(Notification, "count", async () => 1);
  const result = await listNotifications(publisherId);
  assert.deepEqual(find.mock.calls[0].arguments[0].where, { userId: publisherId });
  assert.deepEqual(find.mock.calls[0].arguments[0].order, [["createdAt", "DESC"]]);
  assert.equal(count.mock.calls[0].arguments[0].where.userId, publisherId);
  assert.equal(count.mock.calls[0].arguments[0].where.readAt[Op.is], null);
  assert.equal(result.unreadCount, 1);
  assert.equal(result.notifications[0].propertyId, propertyId);
  assert.equal(JSON.stringify(result).includes("userId"), false);
});

test("marcar notificación propia es idempotente y una ajena resulta inaccesible", async (t) => {
  const own = notification();
  let found = own;
  const find = t.mock.method(Notification, "findOne", async () => found);
  await markNotificationRead(notificationId, publisherId);
  const firstReadAt = own.readAt;
  await markNotificationRead(notificationId, publisherId);
  assert.equal(own.readAt, firstReadAt);
  assert.deepEqual(find.mock.calls[0].arguments[0].where, { id: notificationId, userId: publisherId });
  found = null;
  await assert.rejects(markNotificationRead(notificationId, interestedId), {
    statusCode: 404,
    message: "Notificación no encontrada.",
  });
});

test("read-all modifica únicamente notificaciones propias no leídas", async (t) => {
  const update = t.mock.method(Notification, "update", async () => [3]);
  assert.equal(await markAllNotificationsRead(publisherId), 3);
  const where = update.mock.calls[0].arguments[1].where;
  assert.equal(where.userId, publisherId);
  assert.equal(where.readAt[Op.is], null);
});

test("HTTP permite consulta y view anónimas, pero JWT opcional inválido responde 401", async (t) => {
  t.mock.method(sequelize, "transaction", async (callback) => callback({}));
  t.mock.method(Property, "findOne", async () => property());
  t.mock.method(Consultation, "create", async (values) => consultation(values));
  t.mock.method(Notification, "create", async () => ({}));
  t.mock.method(PropertyView, "create", async () => ({}));
  await withServer(async (baseUrl) => {
    assert.equal((await request(baseUrl, `/api/properties/${propertyId}/consultations`, {
      method: "POST", body: consultationInput,
    })).status, 201);
    assert.equal((await request(baseUrl, `/api/properties/${propertyId}/views`, { method: "POST" })).status, 204);
    const invalid = await fetch(`${baseUrl}/api/properties/${propertyId}/consultations`, {
      method: "POST",
      headers: { Authorization: "Bearer invalid", "Content-Type": "application/json" },
      body: JSON.stringify(consultationInput),
    });
    assert.equal(invalid.status, 401);
  });
});

test("HTTP devuelve el historial de vistas sin fallar en el controller", async (t) => {
  t.mock.method(User, "findByPk", async (id) => ({ id, role: "interested", accountStatus: "active", authVersion: 0 }));
  t.mock.method(sequelize, "query", async (sql) => sql.includes("COUNT(DISTINCT")
    ? [{ total: 1 }]
    : [{ propertyId, lastViewedAt: "2026-01-02T10:00:00.000Z" }]);
  t.mock.method(Property, "findOne", async () => property({ services: [], amenities: [] }));
  await withServer(async (baseUrl) => {
    const result = await request(baseUrl, "/api/users/me/views?page=1&limit=12", {
      token: signAccessToken(interestedId),
    });
    assert.equal(result.status, 200);
    assert.equal(result.body.history[0].property.id, propertyId);
    assert.equal(result.body.history[0].lastViewedAt, "2026-01-02T10:00:00.000Z");
    assert.deepEqual(result.body.pagination, { page: 1, limit: 12, total: 1, totalPages: 1 });
  });
});

test("HTTP asocia consulta autenticada y restringe historial, favoritos y métricas por rol", async (t) => {
  t.mock.method(User, "findByPk", async (id) => ({
    id,
    role: id === adminId ? "admin" : id === publisherId ? "publisher" : "interested",
    accountStatus: "active",
  }));
  t.mock.method(sequelize, "transaction", async (callback) => callback({}));
  t.mock.method(Property, "findOne", async () => property());
  let consultationValues;
  t.mock.method(Consultation, "create", async (values) => {
    consultationValues = values;
    return consultation(values);
  });
  t.mock.method(Consultation, "findAll", async () => []);
  t.mock.method(Notification, "create", async () => ({}));
  t.mock.method(Favorite, "findAll", async () => []);
  t.mock.method(sequelize, "query", async () => []);
  await withServer(async (baseUrl) => {
    assert.equal((await request(baseUrl, `/api/properties/${propertyId}/consultations`, {
      method: "POST", token: signAccessToken(interestedId), body: consultationInput,
    })).status, 201);
    assert.equal(consultationValues.userId, interestedId);
    assert.equal((await request(baseUrl, "/api/users/me/consultations", {
      token: signAccessToken(interestedId),
    })).status, 200);
    assert.equal((await request(baseUrl, "/api/users/me/favorites", {
      token: signAccessToken(adminId),
    })).status, 403);
    assert.equal((await request(baseUrl, "/api/publisher/metrics", {
      token: signAccessToken(interestedId),
    })).status, 403);
    assert.equal((await request(baseUrl, "/api/publisher/metrics", {
      token: signAccessToken(publisherId),
    })).status, 200);
    assert.equal((await request(baseUrl, "/api/publisher/consultations", {
      token: signAccessToken(interestedId),
    })).status, 403);
    assert.equal((await request(baseUrl, "/api/publisher/consultations", {
      token: signAccessToken(publisherId),
    })).status, 200);
  });
});

test("HTTP de notificaciones requiere JWT", async (t) => {
  t.mock.method(User, "findByPk", async (id) => ({ id, role: "interested", accountStatus: "active" }));
  t.mock.method(Notification, "findAll", async () => []);
  t.mock.method(Notification, "count", async () => 0);
  await withServer(async (baseUrl) => {
    assert.equal((await request(baseUrl, "/api/notifications")).status, 401);
    const result = await request(baseUrl, "/api/notifications", { token: signAccessToken(interestedId) });
    assert.equal(result.status, 200);
    assert.deepEqual(result.body, { notifications: [], unreadCount: 0 });
  });
});
