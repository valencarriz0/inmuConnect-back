import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const PropertyService = sequelize.define(
  "PropertyService",
  {
    propertyId: {
      type: DataTypes.UUID,
      field: "property_id",
      allowNull: false,
      primaryKey: true,
    },
    serviceId: {
      type: DataTypes.UUID,
      field: "service_id",
      allowNull: false,
      primaryKey: true,
    },
  },
  {
    schema: "inmobiliaria",
    tableName: "property_services",
    freezeTableName: true,
    timestamps: false,
  },
);

export default PropertyService;
