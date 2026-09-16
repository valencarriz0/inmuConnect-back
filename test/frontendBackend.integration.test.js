import "../test-support/environment.js";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import { test } from "node:test";
import app from "../src/app.js";
import sequelize from "../src/config/database.js";
import { Consultation, Notification, Property } from "../src/models/index.js";

const propertyId = "15b5bc88-1a5c-4f61-86eb-f8c56fb70e30";
const cityId = "dcaa991f-2f83-4273-a4ea-61f0361c52fb";

function publicProperty() {
  return {
    id: propertyId,
    publisherId: "8caa991f-2f83-4273-a4ea-61f0361c52fb",
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
    expenses: null,
    taxes: null,
    commissions: null,
    latitude: "-34.921000",
    longitude: "-57.954000",
    publicationStatus: "active",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    city: { id: cityId, name: "La Plata", province: { id: "d6763e39-4461-4a23-80c9-e8f913c10f20", name: "Buenos Aires" } },
    images: [{ url: "https://example.com/cover.jpg", position: 0 }],
    services: [],
    amenities: [],
  };
}

async function withFrontendAndBackend(callback) {
  const server = createServer(app);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const frontend = await import("../../inmobiliaria-front/src/services/publicPropertyService.ts");
    const consultations = await import("../../inmobiliaria-front/src/services/consultationService.ts");
    const api = await import("../../inmobiliaria-front/src/services/api.ts");
    api.setApiBaseUrl(`http://127.0.0.1:${server.address().port}/api`);
    return await callback({ frontend, consultations });
  } finally {
    const api = await import("../../inmobiliaria-front/src/services/api.ts");
    api.setApiBaseUrl();
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test("integración frontend-backend: catálogo público y consulta anónima usan los contratos reales", async (t) => {
  const item = publicProperty();
  const catalog = t.mock.method(Property, "findAndCountAll", async () => ({ count: 1, rows: [item] }));
  const property = t.mock.method(Property, "findOne", async () => item);
  const transaction = t.mock.method(sequelize, "transaction", async (callback) => callback({}));
  const createConsultation = t.mock.method(Consultation, "create", async (values) => ({
    id: "1e7e5b88-1a5c-4f61-86eb-f8c56fb70e30",
    ...values,
    createdAt: new Date("2026-01-03T00:00:00Z"),
  }));
  const createNotification = t.mock.method(Notification, "create", async () => ({}));

  await withFrontendAndBackend(async ({ frontend, consultations }) => {
    const result = await frontend.getPublicProperties({ operationType: "sale", currency: "USD", minPrice: 100000 });
    assert.equal(catalog.mock.callCount(), 1);
    assert.equal(result.pagination.total, 1);
    assert.equal(result.properties[0].id, propertyId);
    assert.equal(result.properties[0].location.city, "La Plata");

    const created = await consultations.consultationService.create(propertyId, {
      firstName: "Ana",
      lastName: "Pérez",
      email: "ana@example.com",
      phone: "+54 341 555-0100",
      message: "Quisiera coordinar una visita.",
    });
    assert.equal(created.propertyId, propertyId);
    assert.equal(created.email, "ana@example.com");
  });

  assert.equal(catalog.mock.callCount(), 1);
  assert.equal(property.mock.callCount(), 1);
  assert.equal(transaction.mock.callCount(), 1);
  assert.equal(createConsultation.mock.calls[0].arguments[0].userId, null);
  assert.equal(createNotification.mock.callCount(), 1);
});
