import { DataTypes, literal } from "sequelize";
import sequelize from "../config/database.js";

const User = sequelize.define(
  "User",
  {
    id: {
      type: DataTypes.UUID,
      field: "id",
      allowNull: false,
      primaryKey: true,
      defaultValue: literal("gen_random_uuid()"),
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
      allowNull: true,
    },
    passwordHash: {
      type: DataTypes.TEXT,
      field: "password_hash",
      allowNull: false,
    },
    role: {
      type: DataTypes.TEXT,
      field: "role",
      allowNull: false,
      defaultValue: "interested",
      validate: { isIn: [["interested", "publisher", "admin"]] },
    },
    accountStatus: {
      type: DataTypes.TEXT,
      field: "account_status",
      allowNull: false,
      defaultValue: "active",
      validate: { isIn: [["active", "disabled"]] },
    },
    emailVerifiedAt: {
      type: DataTypes.DATE,
      field: "email_verified_at",
      allowNull: true,
    },
    authVersion: {
      type: DataTypes.INTEGER,
      field: "auth_version",
      allowNull: false,
      defaultValue: 0,
      validate: { min: 0 },
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
    tableName: "users",
    freezeTableName: true,
    timestamps: true,
    defaultScope: { attributes: { exclude: ["passwordHash"] } },
  },
);

export default User;
