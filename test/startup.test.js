import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const cwd = fileURLToPath(new URL("../", import.meta.url));

function run(script, overrides = {}) {
  const isolatedScript = 'import dotenv from "dotenv"; dotenv.config = () => ({ parsed: {} });\n' + script;
  return spawnSync(process.execPath, ["--input-type=module", "-e", isolatedScript], {
    cwd,
    encoding: "utf8",
    timeout: 10000,
    env: {
      ...process.env,
      NODE_ENV: "test",
      PORT: "3000",
      DB_CONNECTION_STRING: "postgresql://test:test@localhost:5432/test",
      DB_SSL: "false",
      CORS_ORIGIN: "http://localhost:5173",
      JWT_SECRET: "test-only-fake-secret-never-use-in-production",
      JWT_EXPIRES_IN: "8h",
      NOMINATIM_BASE_URL: "https://nominatim.test",
      NOMINATIM_USER_AGENT: "InmuConnect-tests/1.0",
      NOMINATIM_TIMEOUT_MS: "5000",
      SUPABASE_URL: "https://project.test",
      SUPABASE_SECRET_KEY: "test-placeholder-secret",
      SUPABASE_STORAGE_BUCKET: "property-images",
      ...overrides,
    },
  });
}

test("configuración inválida falla con mensajes claros y sin valores sensibles", () => {
  for (const [overrides, message] of [
    [{ DB_CONNECTION_STRING: "" }, "DB_CONNECTION_STRING es obligatoria"],
    [{ DB_CONNECTION_STRING: "DO_NOT_EXPOSE" }, "URL válida de PostgreSQL"],
    [{ PORT: "3000abc" }, "PORT debe ser"],
    [{ PORT: "65536" }, "PORT debe ser"],
    [{ DB_SSL: "DO_NOT_EXPOSE" }, "DB_SSL debe ser"],
    [{ JWT_SECRET: "" }, "JWT_SECRET es obligatorio"],
    [{ JWT_SECRET: "DO_NOT_EXPOSE" }, "JWT_SECRET es obligatorio"],
    [{ JWT_EXPIRES_IN: "DO_NOT_EXPOSE" }, "JWT_EXPIRES_IN debe ser"],
    [{ JWT_EXPIRES_IN: "0h" }, "JWT_EXPIRES_IN debe ser"],
    [{ JWT_EXPIRES_IN: "3600" }, "JWT_EXPIRES_IN debe ser"],
    [{ NOMINATIM_BASE_URL: "DO_NOT_EXPOSE" }, "NOMINATIM_BASE_URL debe ser"],
    [{ NOMINATIM_USER_AGENT: "" }, "NOMINATIM_USER_AGENT es obligatorio"],
    [{ NOMINATIM_USER_AGENT: "corto" }, "NOMINATIM_USER_AGENT es obligatorio"],
    [{ NOMINATIM_TIMEOUT_MS: "99" }, "NOMINATIM_TIMEOUT_MS debe ser"],
    [{ NOMINATIM_TIMEOUT_MS: "30001" }, "NOMINATIM_TIMEOUT_MS debe ser"],
    [{ NOMINATIM_TIMEOUT_MS: "DO_NOT_EXPOSE" }, "NOMINATIM_TIMEOUT_MS debe ser"],
    [{ SUPABASE_URL: "http://project.test" }, "SUPABASE_URL debe ser"],
    [{ SUPABASE_URL: "DO_NOT_EXPOSE" }, "SUPABASE_URL debe ser"],
    [{ SUPABASE_SECRET_KEY: "", SUPABASE_SERVICE_ROLE_KEY: "" }, "SUPABASE_SECRET_KEY es obligatoria"],
    [{ SUPABASE_STORAGE_BUCKET: "" }, "SUPABASE_STORAGE_BUCKET debe ser"],
    [{ SUPABASE_STORAGE_BUCKET: "../bucket" }, "SUPABASE_STORAGE_BUCKET debe ser"],
  ]) {
    const result = run('await import("./src/config/env.js")', overrides);
    assert.equal(result.status, 1);
    assert.ok(result.stderr.includes(message));
    assert.ok(!result.stderr.includes("DO_NOT_EXPOSE"));
  }
});

test("SSL interpreta true/false y Sequelize se configura sin conectar ni registrar modelos", () => {
  for (const [value, enabled] of [["true", true], ["false", false], [" TRUE ", true]]) {
    const result = run(`
      import assert from "node:assert/strict";
      const { default: env } = await import("./src/config/env.js");
      const { default: sequelize } = await import("./src/config/database.js");
      assert.ok(Object.isFrozen(env));
      assert.equal(env.DB_SSL, ${enabled});
      assert.equal(env.PORT, 3000);
      assert.equal(env.NOMINATIM_BASE_URL, "https://nominatim.test");
      assert.equal(env.NOMINATIM_USER_AGENT, "InmuConnect-tests/1.0");
      assert.equal(env.NOMINATIM_TIMEOUT_MS, 5000);
      assert.equal(env.SUPABASE_URL, "https://project.test");
      assert.equal(env.SUPABASE_STORAGE_BUCKET, "property-images");
      assert.equal(sequelize.options.dialect, "postgres");
      assert.equal(sequelize.options.define.freezeTableName, true);
      assert.equal(sequelize.options.logging, false);
      assert.deepEqual(sequelize.options.dialectOptions.ssl,
        ${enabled} ? { require: true, rejectUnauthorized: false } : false);
      assert.deepEqual(Object.keys(sequelize.models), []);
      await sequelize.close();
    `, { DB_SSL: value });
    assert.equal(result.status, 0, result.stderr);
  }
});

test("configuración acepta SUPABASE_SERVICE_ROLE_KEY sólo como fallback legacy", () => {
  const result = run(`
    import assert from "node:assert/strict";
    const { default: env } = await import("./src/config/env.js");
    assert.equal(env.SUPABASE_SECRET_KEY, "legacy-placeholder");
  `, { SUPABASE_SECRET_KEY: "", SUPABASE_SERVICE_ROLE_KEY: "legacy-placeholder" });
  assert.equal(result.status, 0, result.stderr);
});

test("importar app no abre puertos ni autentica PostgreSQL", () => {
  const result = run(`
    import net from "node:net";
    import { Sequelize } from "sequelize";
    net.Server.prototype.listen = () => { throw new Error("Unexpected listen"); };
    Sequelize.prototype.authenticate = () => { throw new Error("Unexpected authenticate"); };
    await import("./src/app.js");
  `);
  assert.equal(result.status, 0, result.stderr);
});

test("server espera la autenticación antes de iniciar HTTP una sola vez", () => {
  const result = run(`
    import assert from "node:assert/strict";
    import { EventEmitter } from "node:events";
    const { default: sequelize } = await import("./src/config/database.js");
    const { default: app } = await import("./src/app.js");
    let authenticated = false;
    let calls = 0;
    sequelize.authenticate = async () => {
      await new Promise(resolve => setImmediate(resolve));
      authenticated = true;
    };
    app.listen = (port, callback) => {
      assert.equal(authenticated, true);
      assert.equal(port, 3000);
      calls++;
      queueMicrotask(callback);
      return new EventEmitter();
    };
    await import("./src/server.js");
    assert.equal(calls, 1);
    await sequelize.close();
  `);
  assert.equal(result.status, 0, result.stderr);
});

test("fallo de conexión cierra Sequelize y termina con código 1 sin abrir HTTP", () => {
  const result = run(`
    import assert from "node:assert/strict";
    const { default: sequelize } = await import("./src/config/database.js");
    const { default: app } = await import("./src/app.js");
    let listened = false;
    let closed = false;
    sequelize.authenticate = async () => { throw new Error("DO_NOT_EXPOSE"); };
    sequelize.close = async () => { closed = true; };
    app.listen = () => { listened = true; };
    await import("./src/server.js");
    assert.equal(listened, false);
    assert.equal(closed, true);
    assert.equal(process.exitCode, 1);
  `);
  assert.equal(result.status, 1);
  assert.ok(result.stderr.includes("No se pudo iniciar el servidor"));
  assert.ok(!result.stderr.includes("DO_NOT_EXPOSE"));
  assert.equal(result.stdout, "");
});

test("fallo al abrir el puerto también cierra Sequelize y termina con código 1", () => {
  const result = run(`
    import assert from "node:assert/strict";
    import { EventEmitter } from "node:events";
    const { default: sequelize } = await import("./src/config/database.js");
    const { default: app } = await import("./src/app.js");
    let closed = false;
    sequelize.authenticate = async () => {};
    sequelize.close = async () => { closed = true; };
    app.listen = () => {
      const server = new EventEmitter();
      queueMicrotask(() => server.emit("error", new Error("DO_NOT_EXPOSE")));
      return server;
    };
    await import("./src/server.js");
    assert.equal(closed, true);
    assert.equal(process.exitCode, 1);
  `);
  assert.equal(result.status, 1);
  assert.ok(result.stderr.includes("No se pudo iniciar el servidor"));
  assert.ok(!result.stderr.includes("DO_NOT_EXPOSE"));
});
