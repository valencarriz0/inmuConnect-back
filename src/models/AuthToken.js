import { DataTypes, literal } from "sequelize";
import sequelize from "../config/database.js";

const AuthToken = sequelize.define("AuthToken", {
  id: { type: DataTypes.UUID, field: "id", allowNull: false, primaryKey: true, defaultValue: literal("gen_random_uuid()") },
  userId: { type: DataTypes.UUID, field: "user_id", allowNull: false },
  purpose: { type: DataTypes.TEXT, field: "purpose", allowNull: false, validate: { isIn: [["email_verification", "password_reset"]] } },
  tokenHash: { type: DataTypes.TEXT, field: "token_hash", allowNull: false },
  expiresAt: { type: DataTypes.DATE, field: "expires_at", allowNull: false },
  usedAt: { type: DataTypes.DATE, field: "used_at", allowNull: true },
  createdAt: { type: DataTypes.DATE, field: "created_at", allowNull: false, defaultValue: literal("CURRENT_TIMESTAMP") },
}, {
  schema: "inmobiliaria", tableName: "auth_tokens", freezeTableName: true, timestamps: false,
  defaultScope: { attributes: { exclude: ["tokenHash"] } },
});

export default AuthToken;
