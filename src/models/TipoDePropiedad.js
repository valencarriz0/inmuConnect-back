import { DataTypes } from "sequelize";
import sequelize from "../db/sequelize.js";

const TipoDePropiedad = sequelize.define(
  "TipoDePropiedad",
  {
    id: {
      type: DataTypes.BIGINT,
      autoIncrement: true,
      primaryKey: true,
    },
    tipo: DataTypes.TEXT,
  },
  {
    tableName: "TipoDePropiedad",
    timestamps: false,
  }
);

export default TipoDePropiedad;
