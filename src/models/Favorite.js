import { DataTypes, literal } from "sequelize";
import sequelize from "../config/database.js";

const Favorite = sequelize.define(
  "Favorite",
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
      unique: "favorites_user_property_unique",
    },
    propertyId: {
      type: DataTypes.UUID,
      field: "property_id",
      allowNull: false,
      unique: "favorites_user_property_unique",
    },
    createdAt: {
      type: DataTypes.DATE,
      field: "created_at",
      allowNull: false,
      defaultValue: literal("CURRENT_TIMESTAMP"),
    },
  },
  {
    schema: "inmobiliaria",
    tableName: "favorites",
    freezeTableName: true,
    timestamps: true,
    updatedAt: false,
  },
);

export default Favorite;
