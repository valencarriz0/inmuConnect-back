import { DataTypes, literal } from "sequelize";
import sequelize from "../config/database.js";

const SearchAlert = sequelize.define(
  "SearchAlert",
  {
    id: {
      type: DataTypes.UUID,
      field: "id",
      allowNull: false,
      primaryKey: true,
      defaultValue: literal("gen_random_uuid()"),
    },
    userId: {
      type: DataTypes.UUID,
      field: "user_id",
      allowNull: false,
    },
    name: {
      type: DataTypes.TEXT,
      field: "name",
      allowNull: true,
    },
    operationType: {
      type: DataTypes.TEXT,
      field: "operation_type",
      allowNull: true,
      validate: { isIn: [["sale", "rent", "temporary_rent"]] },
    },
    propertyType: {
      type: DataTypes.TEXT,
      field: "property_type",
      allowNull: true,
      validate: { isIn: [["house", "apartment", "land", "commercial"]] },
    },
    provinceId: {
      type: DataTypes.UUID,
      field: "province_id",
      allowNull: true,
    },
    cityId: {
      type: DataTypes.UUID,
      field: "city_id",
      allowNull: true,
    },
    currency: {
      type: DataTypes.STRING(3),
      field: "currency",
      allowNull: true,
      validate: { isIn: [["ARS", "USD"]] },
    },
    minPrice: {
      type: DataTypes.DECIMAL(16, 2),
      field: "min_price",
      allowNull: true,
    },
    maxPrice: {
      type: DataTypes.DECIMAL(16, 2),
      field: "max_price",
      allowNull: true,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      field: "is_active",
      allowNull: false,
      defaultValue: true,
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
    tableName: "search_alerts",
    freezeTableName: true,
    timestamps: true,
  },
);

export default SearchAlert;
