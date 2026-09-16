import "../test-support/environment.js";
import assert from "node:assert/strict";
import fs from "node:fs";
import net from "node:net";
import { mock, test } from "node:test";
import { Model, Sequelize } from "sequelize";

process.env.DB_CONNECTION_STRING = "postgresql://test:test@localhost:5432/test";
process.env.DB_SSL = "false";
process.env.NODE_ENV = "test";
process.env.PORT = "3000";

// Cualquier I/O accidental falla antes de poder alcanzar una base o abrir un puerto.
const guards = [
  mock.method(net.Server.prototype, "listen", () => assert.fail("HTTP no permitido")),
  ...["authenticate", "query", "sync"].map((method) =>
    mock.method(Sequelize.prototype, method, () => assert.fail(`Sequelize.${method} no permitido`))),
  mock.method(Model, "sync", () => assert.fail("Sincronización de modelos no permitida")),
];
const models = await import("../src/models/index.js");
const { default: sequelize } = await import("../src/config/database.js");
const snapshot = JSON.parse(fs.readFileSync(new URL("./fixtures/database-schema.json", import.meta.url)));
const camelCase = (value) => value.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
const actions = { a: "NO ACTION", r: "RESTRICT", c: "CASCADE", n: "SET NULL" };
const types = {
  uuid: "UUID", text: "TEXT", "character varying": "STRING", numeric: "DECIMAL",
  smallint: "SMALLINT", boolean: "BOOLEAN", jsonb: "JSONB", "timestamp with time zone": "DATE",
};

test("importar registra los modelos existentes y el de tokens de autenticación sin I/O", async () => {
  assert.equal(Object.keys(models).length, 18);
  assert.deepEqual(Object.keys(models).filter((name) => name !== "AuthToken").sort(), Object.values(snapshot.tables).sort());
  assert.deepEqual(Object.keys(sequelize.models).sort(), Object.keys(models).sort());
  const importedAgain = await import("../src/models/index.js");
  assert.equal(importedAgain, models);
  for (const guard of guards) assert.equal(guard.mock.callCount(), 0);
});

for (const [table, name] of Object.entries(snapshot.tables)) {
  test(`${name}: columnas, tipos, defaults, PK y timestamps coinciden con PostgreSQL`, () => {
    const model = models[name];
    const attributes = model.getAttributes();
    const columns = snapshot.columns.filter((column) => column.table_name === table);
    const pk = snapshot.constraints.find((constraint) => constraint.table_name === table && constraint.type === "p");
    assert.equal(model.getTableName().schema, "inmobiliaria");
    assert.equal(model.tableName, table);
    assert.equal(model.options.freezeTableName, true);
    const expectedAttributes = columns.map((column) => camelCase(column.column_name));
    if (name === "User") expectedAttributes.push("emailVerifiedAt", "authVersion");
    assert.deepEqual(Object.keys(attributes).sort(), expectedAttributes.sort());
    assert.deepEqual(model.primaryKeyAttributes, pk.columns.map(camelCase));

    for (const column of columns) {
      const attribute = attributes[camelCase(column.column_name)];
      const label = `${table}.${column.column_name}`;
      assert.equal(attribute.field, column.column_name, label);
      assert.equal(attribute.type.key, types[column.data_type], label);
      assert.equal(attribute.allowNull, column.is_nullable === "YES", label);
      assert.ok(!attribute.autoIncrement, label);
      if (column.data_type === "numeric") {
        assert.equal(attribute.type.options.precision, column.numeric_precision, label);
        assert.equal(attribute.type.options.scale, column.numeric_scale, label);
      }
      if (column.data_type === "character varying") {
        assert.equal(attribute.type.options.length, column.character_maximum_length, label);
      }
      const expectedDefault = column.column_default;
      if (["gen_random_uuid()", "CURRENT_TIMESTAMP"].includes(expectedDefault)) {
        assert.equal(attribute.defaultValue.val, expectedDefault, label);
      } else if (expectedDefault === "true") {
        assert.equal(attribute.defaultValue, true, label);
      } else if (expectedDefault) {
        assert.equal(attribute.defaultValue, expectedDefault.match(/^'([^']*)'/)[1], label);
      } else {
        assert.equal(attribute.defaultValue, undefined, label);
      }
    }

    const hasCreatedAt = columns.some((column) => column.column_name === "created_at");
    const hasUpdatedAt = columns.some((column) => column.column_name === "updated_at");
    assert.equal(model.options.timestamps, hasCreatedAt);
    assert.equal(model._timestampAttributes.createdAt, hasCreatedAt ? "createdAt" : undefined);
    assert.equal(model._timestampAttributes.updatedAt, hasUpdatedAt ? "updatedAt" : undefined);
    assert.ok(!model.options.paranoid);
  });
}

test("las 26 FK tienen asociaciones en ambos sentidos y acciones idénticas a PostgreSQL", () => {
  const foreignKeys = snapshot.constraints.filter((constraint) => constraint.type === "f");
  assert.equal(foreignKeys.length, 26);
  for (const fk of foreignKeys) {
    const source = models[snapshot.tables[fk.table_name]];
    const target = models[snapshot.tables[fk.foreign_table]];
    const foreignKey = camelCase(fk.columns[0]);
    const targetKey = camelCase(fk.foreign_columns[0]);
    const matches = Object.values(source.associations).filter((association) =>
      association.associationType === "BelongsTo" && association.foreignKey === foreignKey);
    assert.equal(matches.length, 1, fk.name);
    const association = matches[0];
    assert.equal(association.target, target, fk.name);
    assert.equal(association.targetKey, targetKey, fk.name);
    assert.equal(association.options.onDelete, actions[fk.on_delete], fk.name);
    assert.equal(association.options.onUpdate, actions[fk.on_update], fk.name);
    const attribute = source.getAttributes()[foreignKey];
    assert.equal(attribute.references.model.schema, "inmobiliaria", fk.name);
    assert.equal(attribute.references.model.tableName, fk.foreign_table, fk.name);
    assert.equal(attribute.references.key, fk.foreign_columns[0], fk.name);
    assert.equal(attribute.onDelete, actions[fk.on_delete], fk.name);
    assert.equal(attribute.onUpdate, actions[fk.on_update], fk.name);
    const inverse = Object.values(target.associations).filter((candidate) =>
      ["HasMany", "HasOne"].includes(candidate.associationType) &&
      candidate.target === source && candidate.foreignKey === foreignKey);
    assert.equal(inverse.length, 1, fk.name);
    assert.equal(inverse[0].sourceKey, targetKey, fk.name);
    assert.equal(inverse[0].options.onDelete, actions[fk.on_delete], fk.name);
  }
});

test("AuthToken almacena hashes, propósitos y pertenece al usuario", () => {
  const attributes = models.AuthToken.getAttributes();
  assert.deepEqual(Object.keys(attributes).sort(), ["id", "userId", "purpose", "tokenHash", "expiresAt", "usedAt", "createdAt"].sort());
  assert.equal(models.AuthToken.associations.user.target, models.User);
  assert.equal(models.User.associations.authTokens.target, models.AuthToken);
});

test("aliases distinguen solicitante, revisor y actor, y la propiedad pertenece al perfil", () => {
  assert.equal(models.PublisherApplication.associations.applicant.foreignKey, "userId");
  assert.equal(models.PublisherApplication.associations.reviewer.foreignKey, "reviewedBy");
  assert.equal(models.PropertyChangeHistory.associations.actor.foreignKey, "changedBy");
  assert.equal(models.User.associations.publisherProfile.associationType, "HasOne");
  assert.equal(models.PublisherProfile.associations.user.target, models.User);
  assert.equal(models.Property.associations.publisher.target, models.PublisherProfile);
  assert.equal(models.Property.associations.publisher.targetKey, "userId");
  assert.ok(!Object.values(models.Property.associations).some((association) => association.target === models.User));
  assert.equal(models.Property.associations.city.target, models.City);
  assert.equal(models.City.associations.province.target, models.Province);
});

test("many-to-many usa las PK compuestas sin id ni unicidad adicional", () => {
  for (const [alias, name, join, key] of [
    ["services", "Service", "PropertyService", "serviceId"],
    ["amenities", "Amenity", "PropertyAmenity", "amenityId"],
  ]) {
    const forward = models.Property.associations[alias];
    const reverse = models[name].associations.properties;
    assert.equal(forward.associationType, "BelongsToMany");
    assert.equal(reverse.associationType, "BelongsToMany");
    assert.equal(forward.through.model, models[join]);
    assert.equal(reverse.through.model, models[join]);
    assert.equal(forward.foreignKey, "propertyId");
    assert.equal(forward.otherKey, key);
    assert.equal(reverse.foreignKey, key);
    assert.equal(reverse.otherKey, "propertyId");
    assert.equal(forward.through.unique, false);
    assert.deepEqual(models[join].primaryKeyAttributes, ["propertyId", key]);
    assert.deepEqual(Object.keys(models[join].getAttributes()), ["propertyId", key]);
    assert.deepEqual(models[join].uniqueKeys, {});
  }
});

test("las restricciones UNIQUE declaradas no agregan unicidad simple a email", () => {
  for (const constraint of snapshot.constraints.filter((item) => item.type === "u")) {
    const model = models[snapshot.tables[constraint.table_name]];
    assert.deepEqual(model.uniqueKeys[constraint.name].fields, constraint.columns);
  }
  assert.equal(models.User.getAttributes().email.unique, undefined);
});

test("se conservan las consultas anónimas, métricas sin usuario y nulls funcionales", () => {
  assert.equal(models.Consultation.getAttributes().userId.allowNull, true);
  assert.deepEqual(Object.keys(models.PropertyView.getAttributes()), ["id", "propertyId", "createdAt"]);
  assert.equal(models.Property.getAttributes().acceptsPets.allowNull, true);
  assert.equal(models.Property.getAttributes().rooms.allowNull, false);
  assert.equal(models.PublisherApplication.getAttributes().rejectionReason.allowNull, true);
  assert.equal(models.User.getAttributes().role.defaultValue, "interested");
});

test("validaciones locales aceptan land y estados actuales, y rechazan valores ajenos", async () => {
  const property = models.Property.build({ propertyType: "land", publicationStatus: "deleted", rooms: 1 });
  await property.validate({ fields: ["propertyType", "publicationStatus", "rooms"] });
  property.propertyType = "legacy_type";
  await assert.rejects(property.validate({ fields: ["propertyType"] }), { name: "SequelizeValidationError" });
  property.rooms = 0;
  await assert.rejects(property.validate({ fields: ["rooms"] }), { name: "SequelizeValidationError" });
  for (const position of [0, 4]) {
    await models.PropertyImage.build({ position }).validate({ fields: ["position"] });
  }
  for (const position of [-1, 5]) {
    await assert.rejects(models.PropertyImage.build({ position }).validate({ fields: ["position"] }));
  }
  for (const field of ["operationType", "propertyType", "currency"]) {
    assert.deepEqual(models.Property.getAttributes()[field].validate.isIn,
      models.SearchAlert.getAttributes()[field].validate.isIn);
  }
});

test("User omite passwordHash al generar una consulta normal", async (t) => {
  let generatedSql;
  t.mock.method(sequelize, "query", async (sql) => { generatedSql = sql; return []; });
  await models.User.findAll();
  assert.match(generatedSql, /^SELECT /);
  assert.match(generatedSql, /"first_name" AS "firstName"/);
  assert.doesNotMatch(generatedSql, /password_hash|passwordHash/);
});

test("includes generan joins con schema y columnas físicas correctas sin ejecutar SQL", async (t) => {
  let generatedSql;
  t.mock.method(sequelize, "query", async (sql) => { generatedSql = sql; return []; });
  await models.Property.findAll({
    include: [
      { association: "publisher", include: ["user"] },
      { association: "city", include: ["province"] },
      "images", "services", "amenities",
    ],
  });
  assert.match(generatedSql, /^SELECT /);
  for (const table of ["properties", "publisher_profiles", "users", "cities", "provinces",
    "property_images", "property_services", "services", "property_amenities", "amenities"]) {
    assert.ok(generatedSql.includes(`"inmobiliaria"."${table}"`), table);
  }
  assert.match(generatedSql, /"Property"\."publisher_id" = "publisher"\."user_id"/);
  assert.doesNotMatch(generatedSql, /password_hash|passwordHash/);
  assert.doesNotMatch(generatedSql, /"(?:images|services->PropertyService|amenities->PropertyAmenity)"\."updated_at"/);
});
