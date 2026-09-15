import { DataTypes, literal } from "sequelize";
import sequelize from "../config/database.js";

const PublisherProfile = sequelize.define(
  "PublisherProfile",
  {
    userId: {
      type: DataTypes.UUID,
      field: "user_id",
      allowNull: false,
      primaryKey: true,
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
      unique: "publisher_profiles_tax_id_key",
    },
    agencyName: {
      type: DataTypes.TEXT,
      field: "agency_name",
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
    tableName: "publisher_profiles",
    freezeTableName: true,
    timestamps: true,
  },
);

export default PublisherProfile;
