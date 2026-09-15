import { DataTypes, literal } from "sequelize";
import sequelize from "../config/database.js";

const PublisherApplication = sequelize.define(
  "PublisherApplication",
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
    publisherType: {
      type: DataTypes.TEXT,
      field: "publisher_type",
      allowNull: false,
      validate: { isIn: [["individual", "agency"]] },
    },
    taxId: {
      type: DataTypes.STRING(11),
      field: "tax_id",
      allowNull: false,
    },
    agencyName: {
      type: DataTypes.TEXT,
      field: "agency_name",
      allowNull: true,
    },
    phone: {
      type: DataTypes.TEXT,
      field: "phone",
      allowNull: false,
    },
    status: {
      type: DataTypes.TEXT,
      field: "status",
      allowNull: false,
      defaultValue: "pending",
      validate: { isIn: [["pending", "approved", "rejected"]] },
    },
    reviewedAt: {
      type: DataTypes.DATE,
      field: "reviewed_at",
      allowNull: true,
    },
    reviewedBy: {
      type: DataTypes.UUID,
      field: "reviewed_by",
      allowNull: true,
    },
    rejectionReason: {
      type: DataTypes.TEXT,
      field: "rejection_reason",
      allowNull: true,
    },
    createdAt: {
      type: DataTypes.DATE,
      field: "created_at",
      allowNull: false,
      defaultValue: literal("CURRENT_TIMESTAMP"),
    },
    updatedAt: {
      type: DataTypes.DATE,
      field: "updated_at",
      allowNull: false,
      defaultValue: literal("CURRENT_TIMESTAMP"),
    },
  },
  {
    schema: "inmobiliaria",
    tableName: "publisher_applications",
    freezeTableName: true,
    timestamps: true,
  },
);

export default PublisherApplication;
