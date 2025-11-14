import { DataTypes } from "sequelize";
import sequelize from "../db/sequelize.js";

const CategoriaDePropiedad = sequelize.define(
  "CategoriaDePropiedad",
  {
    id: {
      type: DataTypes.BIGINT,
      autoIncrement: true,
      primaryKey: true,
    },
    categoria: DataTypes.TEXT,
  },
  {
    tableName: "CategoriaDePropiedad",
    timestamps: false,
  }
);

export default CategoriaDePropiedad;
