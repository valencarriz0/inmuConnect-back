import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const PropertyAmenity = sequelize.define(
  "PropertyAmenity",
  {
    propertyId: {
      type: DataTypes.UUID,
      field: "property_id",
      allowNull: false,
      primaryKey: true,
    },
    amenityId: {
      type: DataTypes.UUID,
      field: "amenity_id",
      allowNull: false,
      primaryKey: true,
    },
  },
  {
    schema: "inmobiliaria",
    tableName: "property_amenities",
    freezeTableName: true,
    timestamps: false,
  },
);

export default PropertyAmenity;
