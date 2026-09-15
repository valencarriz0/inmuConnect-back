import { DataTypes, literal } from "sequelize";
import sequelize from "../config/database.js";

const Amenity = sequelize.define(
  "Amenity",
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
      unique: "amenities_code_key",
    },
    name: {
      type: DataTypes.TEXT,
      field: "name",
      allowNull: false,
    },
  },
  {
    schema: "inmobiliaria",
    tableName: "amenities",
    freezeTableName: true,
    timestamps: false,
  },
);

export default Amenity;
