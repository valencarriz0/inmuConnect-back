import { DataTypes, literal } from "sequelize";
import sequelize from "../config/database.js";

const City = sequelize.define(
  "City",
  {
    id: {
      type: DataTypes.UUID,
      field: "id",
      allowNull: false,
      primaryKey: true,
      defaultValue: literal("gen_random_uuid()"),
    },
    provinceId: {
      type: DataTypes.UUID,
      field: "province_id",
      allowNull: false,
      unique: "cities_province_name_unique",
    },
    name: {
      type: DataTypes.TEXT,
      field: "name",
      allowNull: false,
      unique: "cities_province_name_unique",
    },
  },
  {
    schema: "inmobiliaria",
    tableName: "cities",
    freezeTableName: true,
    timestamps: false,
  },
);

export default City;
