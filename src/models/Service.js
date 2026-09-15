import { DataTypes, literal } from "sequelize";
import sequelize from "../config/database.js";

const Service = sequelize.define(
  "Service",
  {
    id: {
      type: DataTypes.UUID,
      field: "id",
      allowNull: false,
      primaryKey: true,
      defaultValue: literal("gen_random_uuid()"),
    },
    code: {
      type: DataTypes.TEXT,
      field: "code",
      allowNull: false,
      unique: "services_code_key",
    },
    name: {
      type: DataTypes.TEXT,
      field: "name",
      allowNull: false,
    },
  },
  {
    schema: "inmobiliaria",
    tableName: "services",
    freezeTableName: true,
    timestamps: false,
  },
);

export default Service;
