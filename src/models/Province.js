import { DataTypes, literal } from "sequelize";
import sequelize from "../config/database.js";

const Province = sequelize.define(
  "Province",
  {
    id: {
      type: DataTypes.UUID,
      field: "id",
      allowNull: false,
      primaryKey: true,
      defaultValue: literal("gen_random_uuid()"),
    },
    country: {
      type: DataTypes.TEXT,
      field: "country",
      allowNull: false,
      defaultValue: "Argentina",
      unique: "provinces_country_name_unique",
    },
    name: {
      type: DataTypes.TEXT,
      field: "name",
      allowNull: false,
      unique: "provinces_country_name_unique",
    },
  },
  {
    schema: "inmobiliaria",
    tableName: "provinces",
    freezeTableName: true,
    timestamps: false,
  },
);

export default Province;
