import { DataTypes, literal } from "sequelize";
import sequelize from "../config/database.js";

const PropertyView = sequelize.define(
  "PropertyView",
  {
    id: {
      type: DataTypes.UUID,
      field: "id",
      allowNull: false,
      primaryKey: true,
      defaultValue: literal("gen_random_uuid()"),
    },
    propertyId: {
      type: DataTypes.UUID,
      field: "property_id",
      allowNull: false,
    },
    userId: {
      type: DataTypes.UUID,
      field: "user_id",
      allowNull: true,
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
    tableName: "property_views",
    freezeTableName: true,
    timestamps: true,
    updatedAt: false,
  },
);

export default PropertyView;
