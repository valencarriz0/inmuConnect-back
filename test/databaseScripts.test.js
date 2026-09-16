import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";

const snapshot = JSON.parse(fs.readFileSync(new URL("./fixtures/database-schema.json", import.meta.url)));
const read = (name) => fs.readFileSync(new URL(`../database/${name}`, import.meta.url), "utf8");
const stripComments = (sql) => sql.replace(/^--.*$/gm, "").trim();
const normalize = (sql) => sql.replace(/\s+/g, " ").trim();
const statements = (sql) => stripComments(sql).split(";").map(normalize).filter(Boolean).sort();

test("01_schema conserva el catálogo y agrega las tablas de seguridad", () => {
  const sql = read("01_schema.sql");
  assert.match(sql, /CREATE SCHEMA inmobiliaria;/);
  const tables = [...sql.matchAll(/CREATE TABLE inmobiliaria\.(\w+) \(\n([\s\S]*?)\n\);/g)];
  assert.deepEqual(tables.map((match) => match[1]).filter((name) => name !== "auth_tokens").sort(), Object.keys(snapshot.tables).sort());
  for (const [, table, body] of tables.filter((entry) => entry[1] !== "auth_tokens")) {
    const columns = snapshot.columns.filter((column) => column.table_name === table);
    const pk = snapshot.constraints.find((constraint) => constraint.table_name === table && constraint.type === "p");
    const expected = columns.map((column) => {
      let type = column.data_type;
      if (type === "numeric") type += `(${column.numeric_precision},${column.numeric_scale})`;
      if (type === "character varying") type += `(${column.character_maximum_length})`;
      return `"${column.column_name}" ${type}` +
        (column.is_nullable === "NO" ? " NOT NULL" : "") +
        (column.column_default ? ` DEFAULT ${column.column_default}` : "");
    });
    expected.push(`CONSTRAINT "${pk.name}" ${pk.definition}`);
    const actual = body.split("\n").map((line) => line.trim().replace(/,$/, ""));
    for (const line of expected) assert.ok(actual.includes(line), table);
  }
  assert.match(sql, /CREATE TABLE inmobiliaria\.auth_tokens/);
  assert.match(sql, /"email_verified_at" timestamp with time zone/);
});

test("02_constraints conserva el catálogo y agrega reglas de seguridad", () => {
  const expected = snapshot.constraints.filter((constraint) => constraint.type !== "p").map((constraint) =>
    normalize(`ALTER TABLE inmobiliaria.${constraint.table_name} ADD CONSTRAINT "${constraint.name}" ${constraint.definition}`));
  const actual = statements(read("02_constraints.sql"));
  for (const statement of expected) assert.ok(actual.includes(statement));
  assert.ok(actual.some((statement) => statement.includes("auth_tokens_purpose_check")));
});

test("03_indexes conserva los índices existentes y agrega los de tokens", () => {
  assert.equal(snapshot.indexes.length, 26);
  const actual = statements(read("03_indexes.sql"));
  for (const index of snapshot.indexes) assert.ok(actual.includes(normalize(index.definition)));
  assert.ok(actual.some((statement) => statement.includes("auth_tokens_token_hash_unique")));
  assert.match(read("03_indexes.sql"), /users_email_unique.*lower\(email\)/);
});

test("04_seed contiene exclusivamente los catálogos actuales y claves naturales", () => {
  const sql = stripComments(read("04_seed.sql"));
  assert.deepEqual([...sql.matchAll(/INSERT INTO inmobiliaria\.(\w+)/g)].map((match) => match[1]),
    ["provinces", "cities", "services", "amenities"]);
  assert.equal((sql.match(/ON CONFLICT .* DO NOTHING/g) || []).length, 4);
  assert.doesNotMatch(sql, /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  assert.match(sql, /SELECT p\.id, location\.city/);
  assert.match(sql, /p\.country = location\.country AND p\.name = location\.province/);
  const tuples = [...sql.matchAll(/^\s*\('([^']*)', '([^']*)'(?:, '([^']*)')?\)/gm)]
    .map((match) => match.slice(1).filter((value) => value !== undefined));
  const data = snapshot.referenceData;
  const expected = [
    ...data.provinces.map((row) => [row.country, row.name]),
    ...data.cities.map((row) => [row.country, row.province, row.name]),
    ...data.services.map((row) => [row.code, row.name]),
    ...data.amenities.map((row) => [row.code, row.name]),
  ];
  assert.deepEqual(tuples, expected);
});

test("SQL local no incluye acciones destructivas, RLS, vistas ni objetos fuera de alcance", () => {
  const sql = ["01_schema.sql", "02_constraints.sql", "03_indexes.sql", "04_seed.sql"].map(read).map(stripComments).join("\n");
  assert.doesNotMatch(sql, /\b(DROP|TRUNCATE)\b/i);
  assert.doesNotMatch(sql, /\bCREATE\s+(VIEW|FUNCTION|TRIGGER|POLICY|TYPE)\b|ROW LEVEL SECURITY/i);
  assert.doesNotMatch(sql, /\bUPDATE\s+inmobiliaria|\bDELETE\s+FROM\b/i);
  assert.doesNotMatch(sql, /property_metrics/);
});
