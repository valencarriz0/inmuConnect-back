import "../test-support/environment.js";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { test } from "node:test";
import { Op } from "sequelize";
import app from "../src/app.js";
import sequelize from "../src/config/database.js";
import storageClient from "../src/integrations/supabase/storageClient.js";
import { validateData } from "../src/middlewares/validate.js";
import {
  Amenity,
  City,
  Property,
  PropertyAmenity,
  PropertyChangeHistory,
  PropertyImage,
  PropertyService,
  PublisherProfile,
  Service,
  User,
} from "../src/models/index.js";
import {
  createPublisherProperty,
  deletePublisherProperty,
  getPublisherProperty,
  getPublisherPropertyHistory,
  listPublisherProperties,
  pausePublisherProperty,
  reactivatePublisherProperty,
  updatePublisherProperty,
} from "../src/modules/properties/publisherProperty.service.js";
import {
  createPublisherPropertySchema,
  publisherPropertyListQuerySchema,
  updatePublisherPropertySchema,
} from "../src/modules/properties/publisherProperty.validation.js";
import { serializePublisherProperty } from "../src/serializers/publisherPropertySerializer.js";
import { signAccessToken } from "../src/utils/jwt.js";

const publisherId = "15b5bc88-1a5c-4f61-86eb-f8c56fb70e30";
const interestedId = "2a85729c-24f1-4f01-b142-62e15ffb2a74";
const adminId = "97b55e08-ac69-48de-b8f4-032fc8695c33";
const propertyId = "d6763e39-4461-4a23-80c9-e8f913c10f20";
const cityId = "dcaa991f-2f83-4273-a4ea-61f0361c52fb";
const provinceId = "8f891fa6-c31a-4082-b32f-e2d306d19a9d";
const serviceId = "a4945137-132a-49c7-8237-a795119f9be7";
const amenityId = "04338a2c-c669-4514-875e-d492619c4fc6";
const imageIds = [
  "11111111-1111-4111-8111-111111111111",
  "22222222-2222-4222-8222-222222222222",
  "33333333-3333-4333-8333-333333333333",
  "44444444-4444-4444-8444-444444444444",
  "55555555-5555-4555-8555-555555555555",
  "66666666-6666-4666-8666-666666666666",
];

function ownedImageUrl(id, extension = "jpg", ownerId = publisherId) {
  return `https://project.test/storage/v1/object/public/property-images/properties/${ownerId}/${id}.${extension}`;
}

const validInput = {
  title: "  Casa con patio  ",
  description: "  Propiedad lista para habitar.  ",
  operationType: "sale",
  propertyType: "house",
  price: 150000,
  currency: "USD",
  cityId,
  street: "  Villegas  ",
  streetNumber: " 350 ",
  totalArea: 120,
  rooms: 4,
  bedrooms: 3,
  bathrooms: 2,
  age: 10,
  propertyCondition: "good",
  acceptsPets: true,
  garage: 1,
  expenses: null,
  taxes: null,
  commissions: null,
  latitude: -35.973123,
  longitude: -62.732456,
  serviceCodes: ["electricity"],
  amenityCodes: ["balcony"],
  images: [ownedImageUrl(imageIds[0], "webp"), ownedImageUrl(imageIds[1])],
};

function cityRecord() {
  return {
    id: cityId,
    name: "Trenque Lauquen",
    provinceId,
    province: { id: provinceId, name: "Buenos Aires" },
  };
}

function serviceRecord(overrides = {}) {
  return { id: serviceId, code: "electricity", name: "Electricidad", ...overrides };
}

function amenityRecord(overrides = {}) {
  return { id: amenityId, code: "balcony", name: "Balcón", ...overrides };
}

function propertyRecord(overrides = {}) {
  const value = {
    id: propertyId,
    publisherId,
    title: "Casa con patio",
    description: "Propiedad lista para habitar.",
    operationType: "sale",
    propertyType: "house",
    price: "150000.00",
    currency: "USD",
    cityId,
    street: "Villegas",
    streetNumber: "350",
    totalArea: "120.00",
    rooms: 4,
    bedrooms: 3,
    bathrooms: 2,
    age: 10,
    propertyCondition: "good",
    acceptsPets: true,
    garage: 1,
    expenses: null,
    taxes: null,
    commissions: null,
    publicationStatus: "active",
    latitude: "-35.973123",
    longitude: "-62.732456",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
  value.update = async (changes) => {
    Object.assign(value, changes, { updatedAt: new Date("2026-01-02T00:00:00Z") });
    return value;
  };
  return value;
}

function validatedCreate(overrides = {}) {
  return validateData(createPublisherPropertySchema, { ...validInput, ...overrides });
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

function mockCurrentRelations(t, {
  images = [
    { url: ownedImageUrl(imageIds[0], "webp"), position: 0 },
    { url: ownedImageUrl(imageIds[1]), position: 1 },
  ],
  services = [serviceRecord()],
  amenities = [amenityRecord()],
} = {}) {
  t.mock.method(PropertyImage, "findAll", async () => images);
  t.mock.method(PropertyService, "findAll", async () => services.map(({ id }) => ({ serviceId: id })));
  t.mock.method(PropertyAmenity, "findAll", async () => amenities.map(({ id }) => ({ amenityId: id })));
  t.mock.method(Service, "findAll", async (options) => options.where.code ? services : services);
  t.mock.method(Amenity, "findAll", async (options) => options.where.code ? amenities : amenities);
  return { images, services, amenities };
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

async function http(baseUrl, path, token) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return { status: response.status, body: await response.json() };
}

test("router exige autenticación, bloquea interested/admin y permite publisher", async (t) => {
  t.mock.method(User, "findByPk", async (id) => ({
    id,
    role: id === publisherId ? "publisher" : id === adminId ? "admin" : "interested",
    accountStatus: "active",
  }));
  const list = t.mock.method(Property, "findAll", async () => []);
  await withServer(async (baseUrl) => {
    assert.equal((await http(baseUrl, "/api/publisher/properties")).status, 401);
    assert.equal((await http(baseUrl, "/api/publisher/properties", signAccessToken(interestedId))).status, 403);
    assert.equal((await http(baseUrl, "/api/publisher/properties", signAccessToken(adminId))).status, 403);
    assert.equal((await http(baseUrl, "/api/publisher/properties", signAccessToken(publisherId))).status, 200);
  });
  assert.equal(list.mock.callCount(), 1);
});

test("create normaliza textos, aplica defaults y rechaza campos controlados por servidor", () => {
  const value = validatedCreate();
  assert.equal(value.title, "Casa con patio");
  assert.equal(value.street, "Villegas");
  for (const field of ["id", "publisherId", "publicationStatus", "createdAt", "updatedAt", "changedBy"]) {
    assert.throws(() => validatedCreate({ [field]: "forbidden" }), { statusCode: 400 });
  }
});

test("create acepta URLs propias y rechaza URLs ajenas o externas antes de la transacción", async (t) => {
  assert.doesNotThrow(() => validatedCreate());
  const transaction = t.mock.method(sequelize, "transaction", () => assert.fail("No debe iniciar transacción"));

  await assert.rejects(createPublisherProperty(publisherId, validatedCreate({
    images: [ownedImageUrl(imageIds[0], "jpg", interestedId), ownedImageUrl(imageIds[1])],
  })), { statusCode: 400 });
  await assert.rejects(createPublisherProperty(publisherId, validatedCreate({
    images: ["https://example.com/externa.jpg", ownedImageUrl(imageIds[1])],
  })), { statusCode: 400 });
  assert.equal(transaction.mock.callCount(), 0);
});

test("create rechaza land, ciudad inválida, precio y rooms inválidos", () => {
  for (const overrides of [
    { propertyType: "land" },
    { cityId: "invalid" },
    { price: 0 },
    { price: -1 },
    { rooms: 0 },
    { totalArea: 0 },
  ]) {
    assert.throws(() => validatedCreate(overrides), { statusCode: 400, message: "Datos inválidos." });
  }
});

test("coordenadas deben ser un par finito dentro de rango", () => {
  assert.equal(validatedCreate().latitude, -35.973123);
  for (const body of [
    { ...validInput, longitude: undefined },
    { ...validInput, latitude: undefined },
    { ...validInput, latitude: 91 },
    { ...validInput, longitude: -181 },
    { ...validInput, latitude: Infinity },
  ]) {
    assert.throws(() => validateData(createPublisherPropertySchema, body), { statusCode: 400 });
  }
  const withoutCoordinates = { ...validInput };
  delete withoutCoordinates.latitude;
  delete withoutCoordinates.longitude;
  const value = validateData(createPublisherPropertySchema, withoutCoordinates);
  assert.equal(Object.hasOwn(value, "latitude"), false);
});

test("imágenes requieren entre 2 y 5 URLs HTTP persistentes", () => {
  for (const images of [
    [ownedImageUrl(imageIds[0])],
    imageIds.map((id) => ownedImageUrl(id)),
    ["blob:https://example.com/id", "https://example.com/two.jpg"],
    ["data:image/png;base64,abc", "https://example.com/two.jpg"],
    ["file:///tmp/a.jpg", "https://example.com/two.jpg"],
  ]) {
    assert.throws(() => validatedCreate({ images }), { statusCode: 400 });
  }
});

test("códigos duplicados y valores numéricos negativos son inválidos", () => {
  for (const overrides of [
    { serviceCodes: ["gas", "gas"] },
    { amenityCodes: ["balcony", "balcony"] },
    { bedrooms: -1 },
    { bathrooms: -1 },
    { garage: -1 },
    { age: -1 },
    { expenses: -1 },
  ]) {
    assert.throws(() => validatedCreate(overrides), { statusCode: 400 });
  }
});

test("create es atómico, usa publisher autenticado, asigna posiciones y registra created", async (t) => {
  const { transaction, state } = managedTransaction(t);
  t.mock.method(PublisherProfile, "findByPk", async (id, options) => {
    assert.equal(id, publisherId);
    assert.equal(options.transaction, transaction);
    return { userId: publisherId };
  });
  t.mock.method(City, "findByPk", async () => cityRecord());
  t.mock.method(Service, "findAll", async () => [serviceRecord()]);
  t.mock.method(Amenity, "findAll", async () => [amenityRecord()]);
  let propertyValues;
  t.mock.method(Property, "create", async (values, options) => {
    propertyValues = values;
    assert.equal(options.transaction, transaction);
    return propertyRecord(values);
  });
  let imageValues;
  t.mock.method(PropertyImage, "bulkCreate", async (values) => { imageValues = values; });
  const serviceCreate = t.mock.method(PropertyService, "bulkCreate", async () => []);
  const amenityCreate = t.mock.method(PropertyAmenity, "bulkCreate", async () => []);
  let historyValues;
  t.mock.method(PropertyChangeHistory, "create", async (values) => { historyValues = values; });

  const result = await createPublisherProperty(publisherId, validatedCreate());
  assert.equal(state.commits, 1);
  assert.equal(state.rollbacks, 0);
  assert.equal(propertyValues.publisherId, publisherId);
  assert.equal(propertyValues.publicationStatus, "active");
  assert.deepEqual(imageValues.map(({ position }) => position), [0, 1]);
  assert.equal(serviceCreate.mock.callCount(), 1);
  assert.equal(amenityCreate.mock.callCount(), 1);
  assert.equal(historyValues.action, "created");
  assert.equal(historyValues.changedBy, publisherId);
  assert.equal(historyValues.previousData, null);
  assert.equal(historyValues.newData.publicationStatus, "active");
  assert.equal(result.price, 150000);
});

test("create exige PublisherProfile y localidad existente", async (t) => {
  const { state } = managedTransaction(t);
  t.mock.method(PublisherProfile, "findByPk", async () => null);
  await assert.rejects(createPublisherProperty(publisherId, validatedCreate()), {
    statusCode: 409,
    message: "La cuenta no tiene un perfil de publicador habilitado.",
  });
  assert.equal(state.rollbacks, 1);

  t.mock.restoreAll();
  const next = managedTransaction(t);
  t.mock.method(PublisherProfile, "findByPk", async () => ({ userId: publisherId }));
  t.mock.method(City, "findByPk", async () => null);
  await assert.rejects(createPublisherProperty(publisherId, validatedCreate()), {
    statusCode: 400,
    message: "La localidad indicada no existe.",
  });
  assert.equal(next.state.rollbacks, 1);
});

test("create rechaza services o amenities desconocidos antes de crear Property", async (t) => {
  managedTransaction(t);
  t.mock.method(PublisherProfile, "findByPk", async () => ({ userId: publisherId }));
  t.mock.method(City, "findByPk", async () => cityRecord());
  t.mock.method(Service, "findAll", async () => []);
  const create = t.mock.method(Property, "create", () => assert.fail("No debe crear Property"));
  await assert.rejects(createPublisherProperty(publisherId, validatedCreate()), {
    statusCode: 400,
    message: "Uno o más servicios no son válidos.",
  });
  assert.equal(create.mock.callCount(), 0);
});

test("create rechaza amenities desconocidos después de validar services", async (t) => {
  managedTransaction(t);
  t.mock.method(PublisherProfile, "findByPk", async () => ({ userId: publisherId }));
  t.mock.method(City, "findByPk", async () => cityRecord());
  t.mock.method(Service, "findAll", async () => [serviceRecord()]);
  t.mock.method(Amenity, "findAll", async () => []);
  const create = t.mock.method(Property, "create", () => assert.fail("No debe crear Property"));
  await assert.rejects(createPublisherProperty(publisherId, validatedCreate()), {
    statusCode: 400,
    message: "Una o más comodidades no son válidos.",
  });
  assert.equal(create.mock.callCount(), 0);
});

test("un fallo intermedio revierte la creación completa", async (t) => {
  const { state } = managedTransaction(t);
  t.mock.method(PublisherProfile, "findByPk", async () => ({ userId: publisherId }));
  t.mock.method(City, "findByPk", async () => cityRecord());
  t.mock.method(Service, "findAll", async () => [serviceRecord()]);
  t.mock.method(Amenity, "findAll", async () => [amenityRecord()]);
  t.mock.method(Property, "create", async () => propertyRecord());
  t.mock.method(PropertyImage, "bulkCreate", async () => { throw new Error("DO_NOT_EXPOSE"); });
  await assert.rejects(createPublisherProperty(publisherId, validatedCreate()), /DO_NOT_EXPOSE/);
  assert.equal(state.commits, 0);
  assert.equal(state.rollbacks, 1);
});

test("listado limita por owner, excluye deleted y admite status", async (t) => {
  const find = t.mock.method(Property, "findAll", async () => []);
  await listPublisherProperties(publisherId, "all");
  const options = find.mock.calls[0].arguments[0];
  assert.equal(options.where.publisherId, publisherId);
  assert.deepEqual(options.where.publicationStatus[Op.in], ["active", "paused"]);
  assert.deepEqual(options.order, [["createdAt", "DESC"], ["id", "ASC"]]);
  await listPublisherProperties(publisherId, "paused");
  assert.equal(find.mock.calls[1].arguments[0].where.publicationStatus, "paused");
  assert.deepEqual(validateData(publisherPropertyListQuerySchema, {}), { status: "all" });
});

test("detalle propio funciona y propiedad ajena o inexistente devuelve el mismo 404", async (t) => {
  const own = propertyRecord({
    city: cityRecord(),
    images: [],
    services: [],
    amenities: [],
  });
  const find = t.mock.method(Property, "findOne", async (options) =>
    options.where.publisherId === publisherId ? own : null);
  assert.equal((await getPublisherProperty(propertyId, publisherId)).id, propertyId);
  await assert.rejects(getPublisherProperty(propertyId, interestedId), {
    statusCode: 404,
    message: "Propiedad no encontrada.",
  });
  assert.equal(find.mock.calls[1].arguments[0].where.id, propertyId);
});

test("PATCH rechaza campos server-owned y colecciones inválidas antes de transacción", () => {
  for (const body of [
    { publisherId },
    { publicationStatus: "paused" },
    { id: propertyId },
    { images: [ownedImageUrl(imageIds[0])] },
    { serviceCodes: ["gas", "gas"] },
    { latitude: -35 },
    {},
  ]) {
    assert.throws(() => validateData(updatePublisherPropertySchema, body), { statusCode: 400 });
  }
});

test("PATCH simple es transaccional, limpia coordenadas al cambiar dirección y registra updated", async (t) => {
  const { transaction, state } = managedTransaction(t);
  const property = propertyRecord();
  const find = t.mock.method(Property, "findOne", async (options) => {
    assert.deepEqual(options.where, { id: propertyId, publisherId });
    assert.equal(options.lock, transaction.LOCK.UPDATE);
    return property;
  });
  mockCurrentRelations(t);
  t.mock.method(City, "findByPk", async () => cityRecord());
  let history;
  t.mock.method(PropertyChangeHistory, "create", async (values) => { history = values; });

  const result = await updatePublisherProperty(propertyId, publisherId, { streetNumber: "351" });
  assert.equal(find.mock.callCount(), 1);
  assert.equal(state.commits, 1);
  assert.equal(property.streetNumber, "351");
  assert.equal(property.latitude, null);
  assert.equal(property.longitude, null);
  assert.equal(history.action, "updated");
  assert.equal(history.previousData.streetNumber, "350");
  assert.equal(history.newData.streetNumber, "351");
  assert.equal(result.latitude, null);
});

test("PATCH de dirección conserva el nuevo par confirmado", async (t) => {
  managedTransaction(t);
  const property = propertyRecord();
  t.mock.method(Property, "findOne", async () => property);
  mockCurrentRelations(t);
  t.mock.method(City, "findByPk", async () => cityRecord());
  t.mock.method(PropertyChangeHistory, "create", async () => ({}));
  const result = await updatePublisherProperty(propertyId, publisherId, {
    street: "Mitre",
    latitude: -35.97,
    longitude: -62.73,
  });
  assert.equal(result.street, "Mitre");
  assert.equal(result.latitude, -35.97);
  assert.equal(result.longitude, -62.73);
});

test("PATCH reemplaza imágenes, services y amenities sólo después de validar", async (t) => {
  const { state } = managedTransaction(t);
  const property = propertyRecord();
  t.mock.method(Property, "findOne", async () => property);
  mockCurrentRelations(t);
  t.mock.method(City, "findByPk", async () => cityRecord());
  const imageDestroy = t.mock.method(PropertyImage, "destroy", async () => 2);
  let newImages;
  t.mock.method(PropertyImage, "bulkCreate", async (values) => { newImages = values; });
  const serviceDestroy = t.mock.method(PropertyService, "destroy", async () => 1);
  const serviceCreate = t.mock.method(PropertyService, "bulkCreate", async () => []);
  const amenityDestroy = t.mock.method(PropertyAmenity, "destroy", async () => 1);
  const amenityCreate = t.mock.method(PropertyAmenity, "bulkCreate", async () => []);
  t.mock.method(PropertyChangeHistory, "create", async () => ({}));
  const images = [ownedImageUrl(imageIds[2]), ownedImageUrl(imageIds[3])];
  const storage = { remove: t.mock.fn(async () => {
    assert.equal(state.commits, 1);
  }) };
  await updatePublisherProperty(propertyId, publisherId, {
    images,
    serviceCodes: [],
    amenityCodes: [],
  }, { storage });
  assert.equal(imageDestroy.mock.callCount(), 1);
  assert.deepEqual(newImages.map(({ position }) => position), [0, 1]);
  assert.equal(serviceDestroy.mock.callCount(), 1);
  assert.equal(serviceCreate.mock.callCount(), 0);
  assert.equal(amenityDestroy.mock.callCount(), 1);
  assert.equal(amenityCreate.mock.callCount(), 0);
  assert.deepEqual(storage.remove.mock.calls[0].arguments[0], [
    `properties/${publisherId}/${imageIds[0]}.webp`,
    `properties/${publisherId}/${imageIds[1]}.jpg`,
  ]);
});

test("PATCH aplica ownership y una falla de limpieza posterior no revierte PostgreSQL", async (t) => {
  const transaction = t.mock.method(sequelize, "transaction", () => assert.fail("No debe iniciar transacción"));
  await assert.rejects(updatePublisherProperty(propertyId, publisherId, {
    images: [ownedImageUrl(imageIds[2]), ownedImageUrl(imageIds[3], "jpg", interestedId)],
  }), { statusCode: 400 });
  assert.equal(transaction.mock.callCount(), 0);

  t.mock.restoreAll();
  const { state } = managedTransaction(t);
  t.mock.method(Property, "findOne", async () => propertyRecord());
  mockCurrentRelations(t);
  t.mock.method(City, "findByPk", async () => cityRecord());
  t.mock.method(PropertyImage, "destroy", async () => 2);
  t.mock.method(PropertyImage, "bulkCreate", async () => []);
  t.mock.method(PropertyChangeHistory, "create", async () => ({}));
  const storage = { remove: t.mock.fn(async () => { throw new Error("DO_NOT_EXPOSE"); }) };
  const logger = { error: t.mock.fn(() => {}) };
  const result = await updatePublisherProperty(propertyId, publisherId, {
    images: [ownedImageUrl(imageIds[2]), ownedImageUrl(imageIds[3])],
  }, { storage, logger });
  assert.equal(state.commits, 1);
  assert.deepEqual(result.images, [ownedImageUrl(imageIds[2]), ownedImageUrl(imageIds[3])]);
  assert.equal(logger.error.mock.callCount(), 1);
  assert.equal(logger.error.mock.calls[0].arguments[0].includes("DO_NOT_EXPOSE"), false);
});

test("PATCH sin cambio efectivo no actualiza ni crea historial", async (t) => {
  managedTransaction(t);
  const property = propertyRecord();
  property.update = t.mock.fn(() => assert.fail("No debe actualizar"));
  t.mock.method(Property, "findOne", async () => property);
  mockCurrentRelations(t);
  t.mock.method(City, "findByPk", async () => cityRecord());
  const history = t.mock.method(PropertyChangeHistory, "create", () => assert.fail("No debe crear historial"));
  const result = await updatePublisherProperty(propertyId, publisherId, { title: "Casa con patio" });
  assert.equal(result.title, "Casa con patio");
  assert.equal(property.update.mock.callCount(), 0);
  assert.equal(history.mock.callCount(), 0);
});

test("PATCH de propiedad ajena devuelve 404 antes de modificar asociaciones", async (t) => {
  const { state } = managedTransaction(t);
  t.mock.method(Property, "findOne", async () => null);
  const destroy = t.mock.method(PropertyImage, "destroy", () => assert.fail("No debe borrar"));
  await assert.rejects(updatePublisherProperty(propertyId, publisherId, { title: "Otro" }), {
    statusCode: 404,
    message: "Propiedad no encontrada.",
  });
  assert.equal(destroy.mock.callCount(), 0);
  assert.equal(state.rollbacks, 1);
});

test("fallo de historial revierte la transacción de PATCH", async (t) => {
  const { state } = managedTransaction(t);
  t.mock.method(Property, "findOne", async () => propertyRecord());
  mockCurrentRelations(t);
  t.mock.method(City, "findByPk", async () => cityRecord());
  t.mock.method(PropertyChangeHistory, "create", async () => { throw new Error("DO_NOT_EXPOSE"); });
  await assert.rejects(updatePublisherProperty(propertyId, publisherId, { title: "Título nuevo" }), /DO_NOT_EXPOSE/);
  assert.equal(state.commits, 0);
  assert.equal(state.rollbacks, 1);
});

function mockStatusOperation(t, status) {
  managedTransaction(t);
  const property = propertyRecord({ publicationStatus: status });
  t.mock.method(Property, "findOne", async () => property);
  mockCurrentRelations(t);
  t.mock.method(City, "findByPk", async () => cityRecord());
  const history = t.mock.method(PropertyChangeHistory, "create", async () => ({}));
  return { property, history };
}

test("pause active y reactivate paused actualizan estado e historial", async (t) => {
  let operation = mockStatusOperation(t, "active");
  assert.equal((await pausePublisherProperty(propertyId, publisherId)).publicationStatus, "paused");
  assert.equal(operation.history.mock.calls[0].arguments[0].action, "paused");

  t.mock.restoreAll();
  operation = mockStatusOperation(t, "paused");
  assert.equal((await reactivatePublisherProperty(propertyId, publisherId)).publicationStatus, "active");
  assert.equal(operation.history.mock.calls[0].arguments[0].action, "reactivated");
});

test("pause paused y reactivate active son idempotentes sin historial", async (t) => {
  let operation = mockStatusOperation(t, "paused");
  await pausePublisherProperty(propertyId, publisherId);
  assert.equal(operation.history.mock.callCount(), 0);

  t.mock.restoreAll();
  operation = mockStatusOperation(t, "active");
  await reactivatePublisherProperty(propertyId, publisherId);
  assert.equal(operation.history.mock.callCount(), 0);
});

test("una propiedad deleted no puede pausarse ni reactivarse", async (t) => {
  managedTransaction(t);
  t.mock.method(Property, "findOne", async () => propertyRecord({ publicationStatus: "deleted" }));
  await assert.rejects(pausePublisherProperty(propertyId, publisherId), { statusCode: 409 });
  await assert.rejects(reactivatePublisherProperty(propertyId, publisherId), { statusCode: 409 });
});

test("DELETE realiza soft delete, conserva relaciones y registra historial", async (t) => {
  managedTransaction(t);
  const property = propertyRecord();
  t.mock.method(Property, "findOne", async () => property);
  mockCurrentRelations(t);
  t.mock.method(City, "findByPk", async () => cityRecord());
  let history;
  t.mock.method(PropertyChangeHistory, "create", async (values) => { history = values; });
  const propertyDestroy = t.mock.method(Property, "destroy", () => assert.fail("No debe borrar Property"));
  const imageDestroy = t.mock.method(PropertyImage, "destroy", () => assert.fail("No debe borrar imágenes"));
  const storageRemove = t.mock.method(storageClient, "remove", () => assert.fail("No debe borrar Storage"));
  const result = await deletePublisherProperty(propertyId, publisherId);
  assert.equal(result.publicationStatus, "deleted");
  assert.equal(history.action, "deleted");
  assert.equal(propertyDestroy.mock.callCount(), 0);
  assert.equal(imageDestroy.mock.callCount(), 0);
  assert.equal(storageRemove.mock.callCount(), 0);
});

test("DELETE repetido es idempotente y no duplica historial", async (t) => {
  const operation = mockStatusOperation(t, "deleted");
  const result = await deletePublisherProperty(propertyId, publisherId);
  assert.equal(result.publicationStatus, "deleted");
  assert.equal(operation.history.mock.callCount(), 0);
});

test("history verifica ownership, ordena descendente y no expone changedBy", async (t) => {
  const propertyFind = t.mock.method(Property, "findOne", async (options) =>
    options.where.publisherId === publisherId ? { id: propertyId } : null);
  const historyFind = t.mock.method(PropertyChangeHistory, "findAll", async () => [{
    id: "history-id",
    action: "updated",
    previousData: { title: "Anterior" },
    newData: { title: "Nueva" },
    changedBy: "PRIVATE_USER",
    createdAt: new Date("2026-01-02T00:00:00Z"),
  }]);
  const result = await getPublisherPropertyHistory(propertyId, publisherId);
  assert.equal(propertyFind.mock.callCount(), 1);
  assert.deepEqual(historyFind.mock.calls[0].arguments[0].order, [["createdAt", "DESC"]]);
  assert.equal(JSON.stringify(result).includes("PRIVATE_USER"), false);
  await assert.rejects(getPublisherPropertyHistory(propertyId, interestedId), { statusCode: 404 });
});

test("serializer privado convierte DECIMAL y coordenadas sin producir NaN", () => {
  const result = serializePublisherProperty({
    ...propertyRecord(),
    city: cityRecord(),
    images: [],
    services: [],
    amenities: [],
  });
  assert.equal(result.price, 150000);
  assert.equal(result.totalArea, 120);
  assert.equal(result.latitude, -35.973123);
  assert.equal(result.longitude, -62.732456);
  const invalid = serializePublisherProperty({
    ...propertyRecord({ latitude: "NaN", longitude: "Infinity", price: "invalid" }),
    city: cityRecord(), images: [], services: [], amenities: [],
  });
  assert.equal(invalid.price, null);
  assert.equal(invalid.latitude, null);
  assert.equal(invalid.longitude, null);
});
