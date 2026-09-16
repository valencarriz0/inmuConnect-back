import "../test-support/environment.js";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { test } from "node:test";
import { Op } from "sequelize";
import app from "../src/app.js";
import { City, Property, PropertyView, Province } from "../src/models/index.js";
import { validateData } from "../src/middlewares/validate.js";
import { getPublicProperty, listPublicProperties } from "../src/modules/properties/property.service.js";
import { propertyListQuerySchema, propertyParamsSchema } from "../src/modules/properties/property.validation.js";
import { listCities, listProvinces, searchLocations } from "../src/modules/locations/location.service.js";
import { cityListQuerySchema, locationSearchQuerySchema } from "../src/modules/locations/location.validation.js";

const propertyId = "15b5bc88-1a5c-4f61-86eb-f8c56fb70e30";
const provinceId = "d6763e39-4461-4a23-80c9-e8f913c10f20";
const cityId = "dcaa991f-2f83-4273-a4ea-61f0361c52fb";

function property(overrides = {}) {
  return {
    id: propertyId,
    publisherId: "PRIVATE_PUBLISHER_ID",
    title: "Departamento céntrico",
    description: "Descripción pública",
    operationType: "sale",
    propertyType: "apartment",
    price: "120000.00",
    currency: "USD",
    cityId,
    street: "San Martín",
    streetNumber: "123",
    totalArea: "80.00",
    rooms: 3,
    bedrooms: 2,
    bathrooms: 1,
    age: 8,
    propertyCondition: "excellent",
    acceptsPets: true,
    garage: 1,
    expenses: "100.00",
    taxes: null,
    commissions: null,
    latitude: "-34.921000",
    longitude: "-57.954000",
    publicationStatus: "active",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-02T00:00:00Z"),
    passwordHash: "PRIVATE_HASH",
    taxId: "PRIVATE_TAX_ID",
    city: {
      id: cityId,
      name: "La Plata",
      provinceId,
      province: { id: provinceId, name: "Buenos Aires" },
    },
    images: [
      { url: "https://example.com/3.jpg", position: 2 },
      { url: "https://example.com/1.jpg", position: 0 },
      { url: "https://example.com/2.jpg", position: 1 },
    ],
    services: [{ id: "s2", code: "gas", name: "Gas" }, { id: "s1", code: "water", name: "Agua" }],
    amenities: [{ id: "a1", code: "pool", name: "Pileta" }],
    ...overrides,
  };
}

function province(overrides = {}) {
  return { id: provinceId, name: "Buenos Aires", country: "Argentina", ...overrides };
}

function city(overrides = {}) {
  return {
    id: cityId,
    name: "La Plata",
    provinceId,
    province: province(),
    ...overrides,
  };
}

function validList(overrides = {}) {
  return validateData(propertyListQuerySchema, overrides);
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

async function json(baseUrl, path) {
  const response = await fetch(`${baseUrl}${path}`);
  return { status: response.status, body: await response.json() };
}

test("1. GET /properties es público y no requiere JWT", async (t) => {
  t.mock.method(Property, "findAndCountAll", async () => ({ count: 0, rows: [] }));
  await withServer(async (baseUrl) => {
    const response = await json(baseUrl, "/api/properties");
    assert.equal(response.status, 200);
  });
});

test("2. listado consulta exclusivamente propiedades active", async (t) => {
  const find = t.mock.method(Property, "findAndCountAll", async () => ({ count: 0, rows: [] }));
  await listPublicProperties(validList());
  assert.equal(find.mock.calls[0].arguments[0].where.publicationStatus, "active");
});

test("3. listado excluye land incluso sin filtros", async (t) => {
  const find = t.mock.method(Property, "findAndCountAll", async () => ({ count: 0, rows: [] }));
  await listPublicProperties(validList());
  assert.equal(find.mock.calls[0].arguments[0].where.propertyType[Op.ne], "land");
});

test("4. listado aplica operationType válido", async (t) => {
  const find = t.mock.method(Property, "findAndCountAll", async () => ({ count: 0, rows: [] }));
  await listPublicProperties(validList({ operationType: "temporary_rent" }));
  assert.equal(find.mock.calls[0].arguments[0].where.operationType, "temporary_rent");
});

test("5. operationType inválido devuelve validación 400", () => {
  assert.throws(() => validList({ operationType: "exchange" }), { statusCode: 400, message: "Datos inválidos." });
});

test("6. listado aplica propertyType válido", async (t) => {
  const find = t.mock.method(Property, "findAndCountAll", async () => ({ count: 0, rows: [] }));
  await listPublicProperties(validList({ propertyType: "house" }));
  assert.equal(find.mock.calls[0].arguments[0].where.propertyType, "house");
});

test("7. propertyType land devuelve 400", () => {
  assert.throws(() => validList({ propertyType: "land" }), { statusCode: 400, message: "Datos inválidos." });
});

test("8. provinceId filtra mediante la asociación City", async (t) => {
  const find = t.mock.method(Property, "findAndCountAll", async () => ({ count: 0, rows: [] }));
  await listPublicProperties(validList({ provinceId }));
  const cityInclude = find.mock.calls[0].arguments[0].include.find((item) => item.association === "city");
  assert.deepEqual(cityInclude.where, { provinceId });
  assert.equal(cityInclude.required, true);
});

test("9. cityId filtra la FK real de Property", async (t) => {
  const find = t.mock.method(Property, "findAndCountAll", async () => ({ count: 0, rows: [] }));
  await listPublicProperties(validList({ cityId }));
  assert.equal(find.mock.calls[0].arguments[0].where.cityId, cityId);
});

test("10. UUID inválido y combinación provinceId+cityId devuelven 400", () => {
  assert.throws(() => validList({ provinceId: "invalid" }), { statusCode: 400 });
  assert.throws(() => validList({ provinceId, cityId }), { statusCode: 400 });
});

test("11. listado aplica currency", async (t) => {
  const find = t.mock.method(Property, "findAndCountAll", async () => ({ count: 0, rows: [] }));
  await listPublicProperties(validList({ currency: "ARS" }));
  assert.equal(find.mock.calls[0].arguments[0].where.currency, "ARS");
});

test("12. listado aplica minPrice con comparación numérica", async (t) => {
  const find = t.mock.method(Property, "findAndCountAll", async () => ({ count: 0, rows: [] }));
  await listPublicProperties(validList({ minPrice: "100" }));
  assert.equal(find.mock.calls[0].arguments[0].where.price[Op.gte], 100);
});

test("13. listado aplica maxPrice con comparación numérica", async (t) => {
  const find = t.mock.method(Property, "findAndCountAll", async () => ({ count: 0, rows: [] }));
  await listPublicProperties(validList({ maxPrice: "200" }));
  assert.equal(find.mock.calls[0].arguments[0].where.price[Op.lte], 200);
});

test("14. minPrice mayor a maxPrice devuelve 400", () => {
  assert.throws(() => validList({ minPrice: 201, maxPrice: 200 }), { statusCode: 400 });
});

for (const [number, sort, expected] of [
  [15, "newest", [["createdAt", "DESC"], ["id", "ASC"]]],
  [16, "price_asc", [["price", "ASC"], ["id", "ASC"]]],
  [17, "price_desc", [["price", "DESC"], ["id", "ASC"]]],
]) {
  test(`${number}. sort ${sort} usa orden estable`, async (t) => {
    const find = t.mock.method(Property, "findAndCountAll", async () => ({ count: 0, rows: [] }));
    await listPublicProperties(validList({ sort }));
    assert.deepEqual(find.mock.calls[0].arguments[0].order, expected);
  });
}

test("18. sort inválido devuelve 400", () => {
  assert.throws(() => validList({ sort: "oldest" }), { statusCode: 400 });
});

test("19. page y limit adoptan los defaults del contrato", () => {
  assert.deepEqual(validList(), { sort: "newest", page: 1, limit: 12 });
});

test("20. limit acepta el máximo de 50", () => {
  assert.equal(validList({ limit: 50 }).limit, 50);
});

test("21. limit superior a 50 devuelve 400", () => {
  assert.throws(() => validList({ limit: 51 }), { statusCode: 400 });
});

test("22. paginación calcula offset, total y totalPages", async (t) => {
  const find = t.mock.method(Property, "findAndCountAll", async () => ({ count: 25, rows: [property()] }));
  const result = await listPublicProperties(validList({ page: 3, limit: 10 }));
  assert.equal(find.mock.calls[0].arguments[0].offset, 20);
  assert.deepEqual(result.pagination, { page: 3, limit: 10, total: 25, totalPages: 3 });
});

test("23. count usa distinct para que los joins no dupliquen propiedades", async (t) => {
  const find = t.mock.method(Property, "findAndCountAll", async () => ({ count: 1, rows: [property()] }));
  const result = await listPublicProperties(validList());
  assert.equal(find.mock.calls[0].arguments[0].distinct, true);
  assert.equal(result.pagination.total, 1);
});

test("24. imágenes del listado se serializan por position ASC", async (t) => {
  t.mock.method(Property, "findAndCountAll", async () => ({ count: 1, rows: [property()] }));
  const result = await listPublicProperties(validList());
  assert.deepEqual(result.properties[0].images, [
    "https://example.com/1.jpg", "https://example.com/2.jpg", "https://example.com/3.jpg",
  ]);
});

test("25. listado no expone campos internos ni incluye publisher", async (t) => {
  const find = t.mock.method(Property, "findAndCountAll", async () => ({ count: 1, rows: [property()] }));
  const result = await listPublicProperties(validList());
  const serialized = JSON.stringify(result);
  assert.ok(!serialized.includes("PRIVATE_"));
  assert.ok(!find.mock.calls[0].arguments[0].include.some((item) => item.association === "publisher"));
});

test("26. UUID inválido en detalle devuelve 400", () => {
  assert.throws(() => validateData(propertyParamsSchema, { id: "invalid" }), { statusCode: 400 });
});

test("27. detalle active existente devuelve contrato público", async (t) => {
  t.mock.method(Property, "findOne", async () => property());
  const result = await getPublicProperty(propertyId);
  assert.equal(result.id, propertyId);
  assert.equal(result.city.name, "La Plata");
  assert.equal(result.province.name, "Buenos Aires");
});

test("28. detalle inexistente devuelve 404 uniforme", async (t) => {
  t.mock.method(Property, "findOne", async () => null);
  await assert.rejects(getPublicProperty(propertyId), { statusCode: 404, message: "Propiedad no encontrada." });
});

for (const [number, status] of [[29, "paused"], [30, "deleted"]]) {
  test(`${number}. detalle ${status} queda fuera de la consulta pública`, async (t) => {
    const find = t.mock.method(Property, "findOne", async () => null);
    await assert.rejects(getPublicProperty(propertyId), { statusCode: 404, message: "Propiedad no encontrada." });
    assert.equal(find.mock.calls[0].arguments[0].where.publicationStatus, "active");
  });
}

test("31. detalle land queda fuera de la consulta pública", async (t) => {
  const find = t.mock.method(Property, "findOne", async () => null);
  await assert.rejects(getPublicProperty(propertyId), { statusCode: 404, message: "Propiedad no encontrada." });
  assert.equal(find.mock.calls[0].arguments[0].where.propertyType[Op.ne], "land");
});

test("32. detalle ordena todas las imágenes", async (t) => {
  t.mock.method(Property, "findOne", async () => property());
  const result = await getPublicProperty(propertyId);
  assert.deepEqual(result.images, [
    "https://example.com/1.jpg", "https://example.com/2.jpg", "https://example.com/3.jpg",
  ]);
});

test("33. detalle incluye services con campos explícitos", async (t) => {
  t.mock.method(Property, "findOne", async () => property());
  const result = await getPublicProperty(propertyId);
  assert.deepEqual(result.services, [
    { id: "s1", code: "water", name: "Agua" }, { id: "s2", code: "gas", name: "Gas" },
  ]);
});

test("34. detalle incluye amenities con campos explícitos", async (t) => {
  t.mock.method(Property, "findOne", async () => property());
  const result = await getPublicProperty(propertyId);
  assert.deepEqual(result.amenities, [{ id: "a1", code: "pool", name: "Pileta" }]);
});

test("35. consultar detalle no escribe property_views", async (t) => {
  t.mock.method(Property, "findOne", async () => property());
  const createView = t.mock.method(PropertyView, "create", () => assert.fail("No debe registrar visualizaciones"));
  await getPublicProperty(propertyId);
  assert.equal(createView.mock.callCount(), 0);
});

test("36. detalle no expone publisher ni información privada", async (t) => {
  const find = t.mock.method(Property, "findOne", async () => property());
  const result = await getPublicProperty(propertyId);
  assert.ok(!JSON.stringify(result).includes("PRIVATE_"));
  assert.ok(!find.mock.calls[0].arguments[0].include.some((item) => item.association === "publisher"));
});

test("37. provincias son públicas y usan serializer explícito", async (t) => {
  t.mock.method(Province, "findAll", async () => [province({ country: "PRIVATE_COUNTRY" })]);
  const result = await listProvinces();
  assert.deepEqual(result, { provinces: [{ id: provinceId, name: "Buenos Aires" }] });
});

test("38. provincias se consultan por name ASC", async (t) => {
  const find = t.mock.method(Province, "findAll", async () => []);
  await listProvinces();
  assert.deepEqual(find.mock.calls[0].arguments[0].order, [["name", "ASC"]]);
});

test("39. cities sin filtro devuelve todas con provincia", async (t) => {
  const find = t.mock.method(City, "findAll", async () => [city()]);
  const result = await listCities();
  assert.equal(Object.hasOwn(find.mock.calls[0].arguments[0], "where"), false);
  assert.deepEqual(result.cities[0], {
    id: cityId, name: "La Plata", provinceId, provinceName: "Buenos Aires",
  });
});

test("40. cities filtra por provinceId", async (t) => {
  const find = t.mock.method(City, "findAll", async () => []);
  await listCities(provinceId);
  assert.deepEqual(find.mock.calls[0].arguments[0].where, { provinceId });
});

test("41. provinceId inválido en cities devuelve 400", () => {
  assert.throws(() => validateData(cityListQuerySchema, { provinceId: "invalid" }), { statusCode: 400 });
});

test("42. search sin q devuelve 400", () => {
  assert.throws(() => validateData(locationSearchQuerySchema, {}), { statusCode: 400 });
});

test("43. q vacío o demasiado corto devuelve 400", () => {
  assert.throws(() => validateData(locationSearchQuerySchema, { q: " a " }), { statusCode: 400 });
});

test("44. search devuelve provincias", async (t) => {
  t.mock.method(Province, "findAll", async () => [province()]);
  t.mock.method(City, "findAll", async () => []);
  const result = await searchLocations("buenos");
  assert.deepEqual(result.locations[0], {
    id: provinceId, type: "province", name: "Buenos Aires", label: "Buenos Aires",
  });
});

test("45. search devuelve ciudades", async (t) => {
  t.mock.method(Province, "findAll", async () => []);
  t.mock.method(City, "findAll", async () => [city()]);
  const result = await searchLocations("plata");
  assert.equal(result.locations[0].type, "city");
});

test("46. label de city incluye la provincia", async (t) => {
  t.mock.method(Province, "findAll", async () => []);
  t.mock.method(City, "findAll", async () => [city()]);
  const result = await searchLocations("plata");
  assert.equal(result.locations[0].label, "La Plata, Buenos Aires");
});

test("47. búsqueda unificada limita la respuesta a 10 resultados", async (t) => {
  t.mock.method(Province, "findAll", async () => Array.from({ length: 10 }, (_, index) =>
    province({ id: `p${index}`, name: `Provincia ${index}` })));
  t.mock.method(City, "findAll", async () => Array.from({ length: 10 }, (_, index) =>
    city({ id: `c${index}`, name: `Ciudad ${index}` })));
  const result = await searchLocations("ia");
  assert.equal(result.locations.length, 10);
});

test("48. búsqueda usa ILIKE case-insensitive y prioriza prefijos", async (t) => {
  const provinceFind = t.mock.method(Province, "findAll", async () => [province({ name: "Aires del Sur" })]);
  t.mock.method(City, "findAll", async () => [city({ name: "Buenos Aires" })]);
  const result = await searchLocations("AIRES");
  assert.equal(provinceFind.mock.calls[0].arguments[0].where.name[Op.iLike], "%AIRES%");
  assert.equal(result.locations[0].name, "Aires del Sur");
});

test("HTTP conecta los cinco endpoints públicos sin consultar Supabase real", async (t) => {
  t.mock.method(Property, "findAndCountAll", async () => ({ count: 0, rows: [] }));
  t.mock.method(Property, "findOne", async () => property());
  t.mock.method(Province, "findAll", async () => []);
  t.mock.method(City, "findAll", async () => []);
  await withServer(async (baseUrl) => {
    const responses = await Promise.all([
      json(baseUrl, "/api/properties"),
      json(baseUrl, `/api/properties/${propertyId}`),
      json(baseUrl, "/api/locations/provinces"),
      json(baseUrl, "/api/locations/cities"),
      json(baseUrl, "/api/locations/search?q=la"),
    ]);
    assert.deepEqual(responses.map(({ status }) => status), [200, 200, 200, 200, 200]);
  });
});
