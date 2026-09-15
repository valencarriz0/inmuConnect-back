import { DataTypes, literal } from "sequelize";
import sequelize from "../config/database.js";

const PropertyChangeHistory = sequelize.define(
  "PropertyChangeHistory",
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
    changedBy: {
      type: DataTypes.UUID,
      field: "changed_by",
      allowNull: true,
    },
    action: {
      type: DataTypes.TEXT,
      field: "action",
      allowNull: false,
      validate: { isIn: [["created", "updated", "paused", "reactivated", "deleted"]] },
    },
    previousData: {
      type: DataTypes.JSONB,
      field: "previous_data",
      allowNull: true,
    },
    newData: {
      type: DataTypes.JSONB,
      field: "new_data",
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
    tableName: "property_change_history",
    freezeTableName: true,
    timestamps: true,
    updatedAt: false,
  },
);

export default PropertyChangeHistory;
