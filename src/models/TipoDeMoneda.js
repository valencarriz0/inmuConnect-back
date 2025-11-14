import { DataTypes } from "sequelize";
import sequelize from "../db/sequelize.js";

const TipoDeMoneda = sequelize.define(
  "TipoDeMoneda",
  {
    id: {
      type: DataTypes.BIGINT,
      autoIncrement: true,
      primaryKey: true,
    },
    moneda: DataTypes.TEXT,
  },
  {
    tableName: "TipoDeMoneda",
    timestamps: false,
  }
);

export default TipoDeMoneda;
