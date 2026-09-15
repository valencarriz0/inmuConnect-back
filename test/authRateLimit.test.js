import "../test-support/environment.js";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { test } from "node:test";
import { Sequelize } from "sequelize";

process.env.NODE_ENV = "production";
const { default: app } = await import("../src/app.js");

test("producción limita login y register a 15 intentos compartidos por IP", async (t) => {
  const guard = t.mock.method(Sequelize.prototype, "query", () => assert.fail("No debe ejecutar SQL"));
  const server = createServer(app);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    for (let attempt = 0; attempt < 17; attempt++) {
      const endpoint = attempt % 2 === 0 ? "login" : "register";
      const response = await fetch(`${base}/api/auth/${endpoint}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
      });
      assert.equal(response.status, attempt < 15 ? 400 : 429);
      const body = await response.json();
      if (attempt >= 15) assert.deepEqual(body, { error: "Demasiados intentos. Intentá nuevamente más tarde." });
    }
    assert.equal(guard.mock.callCount(), 0);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
