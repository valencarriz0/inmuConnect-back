import { DataTypes, literal } from "sequelize";
import sequelize from "../config/database.js";

const Property = sequelize.define(
  "Property",
  {
    id: {
      type: DataTypes.UUID,
      field: "id",
      allowNull: false,
      primaryKey: true,
      defaultValue: literal("gen_random_uuid()"),
    },
    publisherId: {
      type: DataTypes.UUID,
      field: "publisher_id",
      allowNull: false,
    },
    title: {
      type: DataTypes.TEXT,
      field: "title",
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      field: "description",
      allowNull: false,
    },
    operationType: {
      type: DataTypes.TEXT,
      field: "operation_type",
      allowNull: false,
      validate: { isIn: [["sale", "rent", "temporary_rent"]] },
    },
    propertyType: {
      type: DataTypes.TEXT,
      field: "property_type",
      allowNull: false,
      validate: { isIn: [["house", "apartment", "land", "commercial"]] },
    },
    price: {
      type: DataTypes.DECIMAL(16, 2),
      field: "price",
      allowNull: false,
    },
    currency: {
      type: DataTypes.STRING(3),
      field: "currency",
      allowNull: false,
      validate: { isIn: [["ARS", "USD"]] },
    },
    cityId: {
      type: DataTypes.UUID,
      field: "city_id",
      allowNull: false,
    },
    street: {
      type: DataTypes.TEXT,
      field: "street",
      allowNull: true,
    },
    streetNumber: {
      type: DataTypes.STRING(30),
      field: "street_number",
      allowNull: true,
    },
    totalArea: {
      type: DataTypes.DECIMAL(14, 2),
      field: "total_area",
      allowNull: false,
    },
    rooms: {
      type: DataTypes.SMALLINT,
      field: "rooms",
      allowNull: false,
      validate: { min: 1 },
    },
    bedrooms: {
      type: DataTypes.SMALLINT,
      field: "bedrooms",
      allowNull: true,
    },
    bathrooms: {
      type: DataTypes.SMALLINT,
      field: "bathrooms",
      allowNull: true,
    },
    age: {
      type: DataTypes.SMALLINT,
      field: "age",
      allowNull: true,
    },
    propertyCondition: {
      type: DataTypes.TEXT,
      field: "property_condition",
      allowNull: true,
      validate: { isIn: [["new", "excellent", "good", "to-renovate"]] },
    },
    acceptsPets: {
      type: DataTypes.BOOLEAN,
      field: "accepts_pets",
      allowNull: true,
    },
    garage: {
      type: DataTypes.SMALLINT,
      field: "garage",
      allowNull: true,
    },
    expenses: {
      type: DataTypes.DECIMAL(16, 2),
      field: "expenses",
      allowNull: true,
    },
    taxes: {
      type: DataTypes.DECIMAL(16, 2),
      field: "taxes",
      allowNull: true,
    },
    commissions: {
      type: DataTypes.DECIMAL(16, 2),
      field: "commissions",
      allowNull: true,
    },
    publicationStatus: {
      type: DataTypes.TEXT,
      field: "publication_status",
      allowNull: false,
      defaultValue: "active",
      validate: { isIn: [["active", "paused", "deleted"]] },
    },
    latitude: {
      type: DataTypes.DECIMAL(9, 6),
      field: "latitude",
      allowNull: true,
    },
    longitude: {
      type: DataTypes.DECIMAL(9, 6),
      field: "longitude",
      allowNull: true,
    },
    createdAt: {
      type: DataTypes.DATE,
      field: "created_at",
      allowNull: false,
      defaultValue: literal("CURRENT_TIMESTAMP"),
    },
    updatedAt: {
      type: DataTypes.DATE,
      field: "updated_at",
      allowNull: false,
      defaultValue: literal("CURRENT_TIMESTAMP"),
    },
  },
  {
    schema: "inmobiliaria",
    tableName: "properties",
    freezeTableName: true,
    timestamps: true,
  },
);

export default Property;
