import "../test-support/environment.js";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { test } from "node:test";
import app from "../src/app.js";
import { City, User } from "../src/models/index.js";
import { validateData } from "../src/middlewares/validate.js";
import { geocodeAddress } from "../src/modules/locations/location.service.js";
import { geocodeBodySchema } from "../src/modules/locations/location.validation.js";
import {
  createNominatimClient,
  GlobalRequestScheduler,
  MemoryGeocodingCache,
  NOMINATIM_CACHE_MAX_ENTRIES,
  NOMINATIM_CACHE_TTL_MS,
  NOMINATIM_MIN_INTERVAL_MS,
} from "../src/integrations/nominatim/nominatimClient.js";
import { serializePropertySummary } from "../src/serializers/publicPropertySerializer.js";
import { signAccessToken } from "../src/utils/jwt.js";

const cityId = "dcaa991f-2f83-4273-a4ea-61f0361c52fb";
const publisherId = "15b5bc88-1a5c-4f61-86eb-f8c56fb70e30";
const adminId = "d6763e39-4461-4a23-80c9-e8f913c10f20";
const interestedId = "2a85729c-24f1-4f01-b142-62e15ffb2a74";
const validBody = { cityId, street: "Villegas", streetNumber: "350" };
const externalMatch = {
  lat: "-35.973123",
  lon: "-62.732456",
  display_name: "Villegas 350, Trenque Lauquen, Buenos Aires, Argentina",
  boundingbox: ["-35.974", "-35.972", "-62.733", "-62.731"],
  place_id: 123,
  osm_id: 456,
};

function cityRecord() {
  return {
    id: cityId,
    name: "Trenque Lauquen",
    provinceId: "8f891fa6-c31a-4082-b32f-e2d306d19a9d",
    province: { id: "8f891fa6-c31a-4082-b32f-e2d306d19a9d", name: "Buenos Aires", country: "Argentina" },
  };
}

function jsonResponse(payload, { status = 200 } = {}) {
  return { ok: status >= 200 && status < 300, status, json: async () => payload };
}

function immediateClient(overrides = {}) {
  return createNominatimClient({
    baseUrl: "https://nominatim.test",
    userAgent: "InmuConnect-tests/1.0",
    timeoutMs: 5000,
    scheduler: new GlobalRequestScheduler({ intervalMs: 0 }),
    ...overrides,
  });
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

async function request(baseUrl, path, { token, body } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body ?? validBody),
  });
  return { status: response.status, body: await response.json() };
}

test("geocode exige autenticación y bloquea interested", async (t) => {
  const findUser = t.mock.method(User, "findByPk", async (id) => ({
    id,
    role: "interested",
    accountStatus: "active",
  }));
  const findCity = t.mock.method(City, "findByPk", () => assert.fail("No debe consultar la localidad"));
  await withServer(async (baseUrl) => {
    assert.equal((await request(baseUrl, "/api/locations/geocode")).status, 401);
    assert.equal((await request(baseUrl, "/api/locations/geocode", {
      token: signAccessToken(interestedId),
    })).status, 403);
  });
  assert.equal(findUser.mock.callCount(), 1);
  assert.equal(findCity.mock.callCount(), 0);
});

test("publisher y admin pueden geocodificar sin enviar el rol en el body", async (t) => {
  t.mock.method(User, "findByPk", async (id) => ({
    id,
    role: id === adminId ? "admin" : "publisher",
    accountStatus: "active",
  }));
  t.mock.method(City, "findByPk", async () => cityRecord());
  const originalFetch = globalThis.fetch;
  let externalCalls = 0;
  t.mock.method(globalThis, "fetch", async (input, options) => {
    const url = new URL(input);
    if (url.hostname === "127.0.0.1") return originalFetch(input, options);
    externalCalls++;
    return jsonResponse([externalMatch]);
  });
  await withServer(async (baseUrl) => {
    const publisher = await request(baseUrl, "/api/locations/geocode", { token: signAccessToken(publisherId) });
    const admin = await request(baseUrl, "/api/locations/geocode", { token: signAccessToken(adminId) });
    assert.equal(publisher.status, 200);
    assert.equal(admin.status, 200);
    assert.equal(publisher.body.matches[0].latitude, -35.973123);
  });
  assert.equal(externalCalls, 1);
});

test("validación exige cityId y street válidos", () => {
  for (const body of [
    { street: "Villegas" },
    { ...validBody, cityId: "invalid" },
    { cityId, streetNumber: "350" },
    { ...validBody, street: "   " },
  ]) {
    assert.throws(() => validateData(geocodeBodySchema, body), { statusCode: 400, message: "Datos inválidos." });
  }
});

test("streetNumber es opcional y vacío se normaliza a null", () => {
  assert.equal(validateData(geocodeBodySchema, { cityId, street: "  Villegas  " }).streetNumber, null);
  assert.equal(validateData(geocodeBodySchema, { ...validBody, streetNumber: "   " }).streetNumber, null);
  assert.equal(validateData(geocodeBodySchema, { ...validBody, streetNumber: null }).streetNumber, null);
  assert.equal(validateData(geocodeBodySchema, { ...validBody, streetNumber: " 350 bis " }).streetNumber, "350 bis");
});

test("validación rechaza nombres geográficos, coordenadas y campos internos del cliente", () => {
  for (const field of [
    "province", "provinceName", "city", "cityName", "country", "latitude", "longitude", "userId", "publisherId",
  ]) {
    assert.throws(() => validateData(geocodeBodySchema, { ...validBody, [field]: "arbitrario" }), { statusCode: 400 });
  }
});

test("cityId inexistente devuelve 404 sin llamar al proveedor", async (t) => {
  t.mock.method(City, "findByPk", async () => null);
  const client = { geocode: t.mock.fn(() => assert.fail("No debe geocodificar")) };
  await assert.rejects(geocodeAddress(validBody, { client }), {
    statusCode: 404,
    message: "Localidad no encontrada.",
  });
  assert.equal(client.geocode.mock.callCount(), 0);
});

test("service recupera City con Province y usa exclusivamente nombres de la BD", async (t) => {
  const find = t.mock.method(City, "findByPk", async () => cityRecord());
  let received;
  const client = { geocode: async (address) => { received = address; return { matches: [] }; } };
  await geocodeAddress({ ...validBody, city: "Falsa", province: "Falsa" }, { client });
  assert.deepEqual(find.mock.calls[0].arguments[1].include, [
    { association: "province", attributes: ["id", "name", "country"], required: true },
  ]);
  assert.deepEqual(received, {
    cityId,
    street: "Villegas",
    streetNumber: "350",
    city: "Trenque Lauquen",
    province: "Buenos Aires",
    country: "Argentina",
  });
});

test("cliente usa URL, User-Agent y parámetros oficiales configurados", async () => {
  let requestUrl;
  let requestOptions;
  const client = immediateClient({
    baseUrl: "https://provider.example/base",
    userAgent: "InmuConnect-academico/1.0",
    fetchImpl: async (url, options) => {
      requestUrl = url;
      requestOptions = options;
      return jsonResponse([externalMatch]);
    },
  });
  await client.geocode({ ...cityRecord(), ...validBody, city: "Trenque Lauquen", province: "Buenos Aires", country: "Argentina" });
  assert.equal(requestUrl.origin, "https://provider.example");
  assert.equal(requestUrl.pathname, "/base/search");
  assert.equal(requestUrl.searchParams.get("format"), "jsonv2");
  assert.equal(requestUrl.searchParams.get("addressdetails"), "1");
  assert.equal(requestUrl.searchParams.get("limit"), "5");
  assert.equal(requestUrl.searchParams.get("countrycodes"), "ar");
  assert.ok(requestUrl.searchParams.get("q").includes("350 Villegas"));
  assert.equal(requestUrl.searchParams.has("city"), false);
  assert.equal(requestOptions.headers["User-Agent"], "InmuConnect-academico/1.0");
  assert.equal(requestOptions.headers["Accept-Language"], "es");
});

test("cliente aplica el timeout configurado mediante AbortController", async () => {
  let configuredDelay;
  let cleared = false;
  const client = immediateClient({
    timeoutMs: 4321,
    setTimer: (callback, delay) => { configuredDelay = delay; return callback; },
    clearTimer: () => { cleared = true; },
    fetchImpl: async () => jsonResponse([]),
  });
  await client.geocode({ ...validBody, city: "Trenque Lauquen", province: "Buenos Aires", country: "Argentina" });
  assert.equal(configuredDelay, 4321);
  assert.equal(cleared, true);
});

test("cliente normaliza coordenadas, boundingBox y elimina campos crudos", async () => {
  const client = immediateClient({ fetchImpl: async () => jsonResponse([externalMatch]) });
  const result = await client.geocode({ ...validBody, city: "Trenque Lauquen", province: "Buenos Aires", country: "Argentina" });
  assert.deepEqual(result, { matches: [{
    latitude: -35.973123,
    longitude: -62.732456,
    displayName: externalMatch.display_name,
    boundingBox: { south: -35.974, north: -35.972, west: -62.733, east: -62.731 },
  }] });
  assert.ok(!JSON.stringify(result).includes("place_id"));
});

test("cliente descarta coordenadas inválidas y usa boundingBox null si no es válido", async () => {
  const payload = [
    { ...externalMatch, lat: "NaN" },
    { ...externalMatch, lon: "Infinity" },
    { ...externalMatch, lat: "91" },
    { ...externalMatch, lon: "181" },
    { ...externalMatch, boundingbox: ["invalid"] },
  ];
  const client = immediateClient({ fetchImpl: async () => jsonResponse(payload) });
  const result = await client.geocode({ ...validBody, city: "Trenque Lauquen", province: "Buenos Aires", country: "Argentina" });
  assert.equal(result.matches.length, 1);
  assert.equal(result.matches[0].boundingBox, null);
});

test("respuesta externa vacía produce matches vacío", async () => {
  const client = immediateClient({ fetchImpl: async () => jsonResponse([]) });
  assert.deepEqual(await client.geocode({ ...validBody, city: "X", province: "Y", country: "Argentina" }), { matches: [] });
});

test("payload inesperado y JSON inválido producen un 503 seguro", async () => {
  for (const fetchImpl of [
    async () => jsonResponse({ unexpected: true }),
    async () => ({ ok: true, json: async () => { throw new SyntaxError("DO_NOT_EXPOSE"); } }),
  ]) {
    const client = immediateClient({ fetchImpl });
    await assert.rejects(client.geocode({ ...validBody, city: "X", province: "Y", country: "Argentina" }), {
      statusCode: 503,
      message: "El servicio de geolocalización no está disponible en este momento.",
    });
  }
});

test("timeout y fallo de red producen un 503 seguro", async () => {
  for (const error of [new DOMException("DO_NOT_EXPOSE", "AbortError"), new Error("DO_NOT_EXPOSE")]) {
    const client = immediateClient({ fetchImpl: async () => { throw error; } });
    await assert.rejects(client.geocode({ ...validBody, city: "X", province: "Y", country: "Argentina" }), {
      statusCode: 503,
      message: "El servicio de geolocalización no está disponible en este momento.",
    });
  }
});

test("respuestas 429 y 5xx producen un 503 seguro", async () => {
  for (const status of [429, 500, 503]) {
    const client = immediateClient({ fetchImpl: async () => jsonResponse({ private: "DO_NOT_EXPOSE" }, { status }) });
    await assert.rejects(client.geocode({ ...validBody, city: "X", province: "Y", country: "Argentina" }), {
      statusCode: 503,
      message: "El servicio de geolocalización no está disponible en este momento.",
    });
  }
});

test("misma dirección y variantes normalizadas reutilizan la caché", async () => {
  let calls = 0;
  const client = immediateClient({ fetchImpl: async () => { calls++; return jsonResponse([externalMatch]); } });
  const base = { cityId, street: "Córdoba", streetNumber: " 350 ", city: "X", province: "Y", country: "Argentina" };
  const first = await client.geocode(base);
  const second = await client.geocode({ ...base, street: "  cordoba  ", streetNumber: "350" });
  assert.deepEqual(second, first);
  assert.equal(calls, 1);
});

test("caché expira después del TTL", async () => {
  let now = 1000;
  let calls = 0;
  const cache = new MemoryGeocodingCache({ ttlMs: 50, clock: () => now });
  const client = immediateClient({ cache, fetchImpl: async () => { calls++; return jsonResponse([]); } });
  const address = { ...validBody, city: "X", province: "Y", country: "Argentina" };
  await client.geocode(address);
  now += 49;
  await client.geocode(address);
  now += 1;
  await client.geocode(address);
  assert.equal(calls, 2);
});

test("caché descarta la entrada menos reciente al alcanzar su tamaño máximo", async () => {
  let calls = 0;
  const cache = new MemoryGeocodingCache({ maxEntries: 2 });
  const client = immediateClient({ cache, fetchImpl: async () => { calls++; return jsonResponse([]); } });
  const address = (street) => ({ cityId, street, streetNumber: null, city: "X", province: "Y", country: "Argentina" });
  await client.geocode(address("Uno"));
  await client.geocode(address("Dos"));
  await client.geocode(address("Tres"));
  await client.geocode(address("Uno"));
  assert.equal(cache.entries.size, 2);
  assert.equal(calls, 4);
  assert.equal(NOMINATIM_CACHE_TTL_MS, 24 * 60 * 60 * 1000);
  assert.equal(NOMINATIM_CACHE_MAX_ENTRIES, 500);
});

test("requests idénticas concurrentes comparten una sola llamada externa", async () => {
  let release;
  let calls = 0;
  const gate = new Promise((resolve) => { release = resolve; });
  const client = immediateClient({
    fetchImpl: async () => { calls++; await gate; return jsonResponse([externalMatch]); },
  });
  const address = { ...validBody, city: "X", province: "Y", country: "Argentina" };
  const first = client.geocode(address);
  const second = client.geocode(address);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls, 1);
  release();
  assert.deepEqual(await first, await second);
});

test("scheduler separa requests y serializa concurrencia sin esperas reales", async () => {
  let now = 0;
  const waits = [];
  const starts = [];
  const scheduler = new GlobalRequestScheduler({
    intervalMs: 1100,
    clock: () => now,
    sleep: async (milliseconds) => { waits.push(milliseconds); now += milliseconds; },
  });
  await Promise.all([
    scheduler.schedule(async () => starts.push(now)),
    scheduler.schedule(async () => starts.push(now)),
    scheduler.schedule(async () => starts.push(now)),
  ]);
  assert.deepEqual(starts, [0, 1100, 2200]);
  assert.deepEqual(waits, [1100, 1100]);
  assert.equal(NOMINATIM_MIN_INTERVAL_MS, 1100);
});

function publicProperty(latitude, longitude) {
  return serializePropertySummary({
    id: "property", latitude, longitude, city: null, images: [],
  });
}

test("serializer público convierte coordenadas DECIMAL a number", () => {
  const result = publicProperty("-35.973123", "-62.732456");
  assert.equal(result.latitude, -35.973123);
  assert.equal(result.longitude, -62.732456);
  assert.equal(typeof result.latitude, "number");
  assert.equal(typeof result.longitude, "number");
});

test("serializer mantiene ambas coordenadas null", () => {
  assert.deepEqual(
    { latitude: publicProperty(null, null).latitude, longitude: publicProperty(null, null).longitude },
    { latitude: null, longitude: null },
  );
});

test("serializer no expone NaN, Infinity ni pares incompletos", () => {
  for (const [latitude, longitude] of [["NaN", "1"], ["1", "Infinity"], ["91", "1"], ["1", null]]) {
    const result = publicProperty(latitude, longitude);
    assert.equal(result.latitude, null);
    assert.equal(result.longitude, null);
  }
});

test("serializer conserva el contrato público existente", () => {
  const result = serializePropertySummary({
    id: "property", title: "Casa", price: "100.00", latitude: "-35", longitude: "-62",
    city: { id: cityId, name: "Trenque Lauquen", province: { id: "province", name: "Buenos Aires" } },
    images: [{ url: "second", position: 1 }, { url: "first", position: 0 }],
  });
  assert.equal(result.title, "Casa");
  assert.equal(result.price, "100.00");
  assert.deepEqual(result.images, ["first", "second"]);
  assert.equal(result.city.name, "Trenque Lauquen");
});
