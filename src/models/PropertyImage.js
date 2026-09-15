import { DataTypes, literal } from "sequelize";
import sequelize from "../config/database.js";

const PropertyImage = sequelize.define(
  "PropertyImage",
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
      unique: "property_images_position_unique",
    },
    url: {
      type: DataTypes.TEXT,
      field: "url",
      allowNull: false,
    },
    position: {
      type: DataTypes.SMALLINT,
      field: "position",
      allowNull: false,
      unique: "property_images_position_unique",
      validate: { min: 0, max: 4 },
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
    tableName: "property_images",
    freezeTableName: true,
    timestamps: true,
    updatedAt: false,
  },
);

export default PropertyImage;
