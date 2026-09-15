import "../test-support/environment.js";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { after, before, test } from "node:test";
import errorHandler from "../src/middlewares/errorHandler.js";

process.env.DB_CONNECTION_STRING = "postgresql://test:test@localhost:5432/test";
process.env.DB_SSL = "false";
process.env.NODE_ENV = "test";
process.env.PORT = "3000";
process.env.CORS_ORIGIN = "http://localhost:5173";

const { default: app } = await import("../src/app.js");
let server;
let baseUrl;

before(async () => {
  server = createServer(app);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server?.listening) {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("health responde 200, fecha ISO, CORS y encabezados de rate limit", async () => {
  const response = await fetch(`${baseUrl}/api/health`, {
    headers: { Origin: "http://localhost:5173" },
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.status, "ok");
  assert.equal(body.service, "inmuconnect-back");
  assert.equal(new Date(body.timestamp).toISOString(), body.timestamp);
  assert.equal(response.headers.get("access-control-allow-origin"), "http://localhost:5173");
  assert.equal(response.headers.get("x-powered-by"), null);
  assert.equal(response.headers.get("ratelimit-limit"), "1000");
});

test("rutas inexistentes y rutas anteriores responden 404 JSON", async () => {
  for (const path of ["/missing", "/api/missing", "/api/usuarios", "/api/publicaciones"]) {
    const response = await fetch(`${baseUrl}${path}`);
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: "Recurso no encontrado" });
  }
});

test("JSON inválido responde 400 sin revelar el cuerpo recibido", async () => {
  const response = await fetch(`${baseUrl}/api/health`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: '{"sensitive":"DO_NOT_EXPOSE",}',
  });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "Solicitud inválida" });
});

test("errorHandler respeta estados válidos y oculta mensajes y stacks", () => {
  for (const [properties, expectedStatus] of [
    [{}, 500], [{ statusCode: 503 }, 503], [{ statusCode: 401 }, 401],
    [{ status: 413 }, 413], [{ statusCode: 200 }, 500], [{ statusCode: "401" }, 500],
  ]) {
    const error = Object.assign(new Error("DO_NOT_EXPOSE"), properties);
    const response = {
      status(code) { this.statusCode = code; return this; },
      json(body) { this.body = body; },
    };
    errorHandler(error, {}, response, () => assert.fail("unexpected next"));
    assert.equal(response.statusCode, expectedStatus);
    assert.deepEqual(Object.keys(response.body), ["error"]);
    assert.ok(!JSON.stringify(response.body).includes("DO_NOT_EXPOSE"));
    if (expectedStatus >= 500) {
      assert.equal(response.body.error, "Error interno del servidor");
    }
  }
});

test("errorHandler delega si ya se enviaron los encabezados", () => {
  const error = new Error("failure");
  let forwarded;
  errorHandler(error, {}, { headersSent: true }, (value) => { forwarded = value; });
  assert.equal(forwarded, error);
});
