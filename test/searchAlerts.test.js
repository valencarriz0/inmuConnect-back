import "../test-support/environment.js";
import assert from "node:assert/strict";
import { test } from "node:test";
import { Op } from "sequelize";
import { Notification, SearchAlert } from "../src/models/index.js";
import { mailer } from "../src/integrations/mail/mailer.js";
import { notifySearchAlertMatches } from "../src/modules/search-alerts/searchAlert.service.js";
import { create as createController } from "../src/modules/search-alerts/searchAlert.controller.js";

const property = {
  id: "15b5bc88-1a5c-4f61-86eb-f8c56fb70e30",
  title: "Casa céntrica",
  operationType: "sale",
  propertyType: "house",
  cityId: "11111111-1111-4111-8111-111111111111",
  city: { name: "Trenque Lauquen", provinceId: "04338a2c-c669-4514-875e-d492619c4fc6" },
  currency: "USD",
  price: 100000,
};

const alert = {
  id: "8f891fa6-c31a-4082-b32f-e2d306d19a9d",
  userId: "2a85729c-24f1-4f01-b142-62e15ffb2a74",
  name: "Casas en Trenque Lauquen",
  user: { email: "ana@example.com" },
};

test("una coincidencia activa crea la notificación y solicita el correo", async (t) => {
  const findAlerts = t.mock.method(SearchAlert, "findAll", async () => [alert]);
  const findOrCreate = t.mock.method(Notification, "findOrCreate", async () => [{}, true]);
  const sendEmail = t.mock.method(mailer, "sendSearchAlertEmail", async () => undefined);

  await notifySearchAlertMatches(property);

  const where = findAlerts.mock.calls[0].arguments[0].where;
  assert.equal(where.isActive, true);
  assert.equal(where[Op.and].length, 7);
  assert.equal(where[Op.and][0][Op.or][1].operationType, "sale");
  assert.equal(where[Op.and][1][Op.or][1].propertyType, "house");
  assert.equal(where[Op.and][2][Op.or][1].cityId, property.cityId);
  assert.equal(where[Op.and][3][Op.or][1].provinceId, property.city.provinceId);
  assert.equal(where[Op.and][4][Op.or][1].currency, "USD");
  assert.equal(where[Op.and][5][Op.or][1].minPrice[Op.lte], 100000);
  assert.equal(where[Op.and][6][Op.or][1].maxPrice[Op.gte], 100000);
  assert.deepEqual(findOrCreate.mock.calls[0].arguments[0].defaults, {
    userId: alert.userId,
    type: "new_property_match",
    title: "Nueva propiedad que coincide con tu alerta",
    message: property.title,
    searchAlertId: alert.id,
    propertyId: property.id,
  });
  assert.deepEqual(sendEmail.mock.calls[0].arguments[0], { to: "ana@example.com", alertName: alert.name, property });
});

test("una propiedad sin coincidencias o con alertas inactivas no genera efectos", async (t) => {
  t.mock.method(SearchAlert, "findAll", async () => []);
  const findOrCreate = t.mock.method(Notification, "findOrCreate", async () => assert.fail("No debe crear notificación"));
  const sendEmail = t.mock.method(mailer, "sendSearchAlertEmail", async () => assert.fail("No debe enviar correo"));

  await notifySearchAlertMatches({ ...property, operationType: "rent", currency: "ARS" });

  assert.equal(findOrCreate.mock.callCount(), 0);
  assert.equal(sendEmail.mock.callCount(), 0);
});

test("una coincidencia ya notificada no duplica el correo", async (t) => {
  t.mock.method(SearchAlert, "findAll", async () => [alert]);
  const findOrCreate = t.mock.method(Notification, "findOrCreate", async () => [{}, false]);
  const sendEmail = t.mock.method(mailer, "sendSearchAlertEmail", async () => assert.fail("No debe enviar correo duplicado"));

  await notifySearchAlertMatches(property);

  assert.equal(findOrCreate.mock.callCount(), 1);
  assert.equal(sendEmail.mock.callCount(), 0);
});

test("un error de email se registra y no interrumpe la creación de la propiedad", async (t) => {
  t.mock.method(SearchAlert, "findAll", async () => [alert]);
  t.mock.method(Notification, "findOrCreate", async () => [{}, true]);
  t.mock.method(mailer, "sendSearchAlertEmail", async () => { throw new Error("SMTP no disponible"); });
  const logger = { error: t.mock.fn() };

  await assert.doesNotReject(notifySearchAlertMatches(property, logger));
  assert.equal(logger.error.mock.callCount(), 1);
});

test("controller de alertas toma el usuario autenticado y responde 201", async (t) => {
  const userId = "2a85729c-24f1-4f01-b142-62e15ffb2a74";
  const created = { id: alert.id };
  const stored = {
    ...created,
    userId,
    name: "Venta",
    operationType: "sale",
    propertyType: null,
    provinceId: null,
    cityId: null,
    currency: null,
    minPrice: null,
    maxPrice: null,
    isActive: true,
    createdAt: null,
    get: () => ({ ...stored }),
  };
  t.mock.method(SearchAlert, "create", async (values) => {
    assert.equal(values.userId, userId);
    return created;
  });
  t.mock.method(SearchAlert, "findOne", async (query) => {
    assert.deepEqual(query.where, { id: alert.id, userId });
    return stored;
  });
  const response = { statusCode: null, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; } };

  await createController({ user: { id: userId }, body: { name: "Venta", operationType: "sale" } }, response);

  assert.equal(response.statusCode, 201);
  assert.equal(response.body.alert.id, alert.id);
  assert.equal(response.body.alert.isActive, true);
});
