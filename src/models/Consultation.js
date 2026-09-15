import { DataTypes, literal } from "sequelize";
import sequelize from "../config/database.js";

const Consultation = sequelize.define(
  "Consultation",
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
    firstName: {
      type: DataTypes.TEXT,
      field: "first_name",
      allowNull: false,
    },
    lastName: {
      type: DataTypes.TEXT,
      field: "last_name",
      allowNull: false,
    },
    email: {
      type: DataTypes.TEXT,
      field: "email",
      allowNull: false,
    },
    phone: {
      type: DataTypes.TEXT,
      field: "phone",
      allowNull: false,
    },
    message: {
      type: DataTypes.TEXT,
      field: "message",
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
    tableName: "consultations",
    freezeTableName: true,
    timestamps: true,
    updatedAt: false,
  },
);

export default Consultation;
