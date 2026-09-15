import { DataTypes, literal } from "sequelize";
import sequelize from "../config/database.js";

const Notification = sequelize.define(
  "Notification",
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
    },
    type: {
      type: DataTypes.TEXT,
      field: "type",
      allowNull: false,
      validate: { isIn: [["new_consultation", "publisher_approved", "publisher_rejected", "new_property_match"]] },
    },
    title: {
      type: DataTypes.TEXT,
      field: "title",
      allowNull: false,
    },
    message: {
      type: DataTypes.TEXT,
      field: "message",
      allowNull: true,
    },
    consultationId: {
      type: DataTypes.UUID,
      field: "consultation_id",
      allowNull: true,
    },
    publisherApplicationId: {
      type: DataTypes.UUID,
      field: "publisher_application_id",
      allowNull: true,
    },
    searchAlertId: {
      type: DataTypes.UUID,
      field: "search_alert_id",
      allowNull: true,
    },
    propertyId: {
      type: DataTypes.UUID,
      field: "property_id",
      allowNull: true,
    },
    readAt: {
      type: DataTypes.DATE,
      field: "read_at",
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
    tableName: "notifications",
    freezeTableName: true,
    timestamps: true,
    updatedAt: false,
  },
);

export default Notification;
