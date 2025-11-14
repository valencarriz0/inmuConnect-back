import { DataTypes } from "sequelize";
import sequelize from "../db/sequelize.js";
import TipoDePropiedad from "./TipoDePropiedad.js";
import TipoDeMoneda from "./TipoDeMoneda.js";
import CategoriaDePropiedad from "./CategoriaDePropiedad.js";
import Usuario from "./Usuario.js";

const Publicacion = sequelize.define(
  "Publicacion",
  {
    id: {
      type: DataTypes.BIGINT,
      autoIncrement: true,
      primaryKey: true,
    },
    created_at: DataTypes.DATE,
    titulo: DataTypes.TEXT,
    altura: DataTypes.BIGINT,
    precio: DataTypes.FLOAT,
    calle: DataTypes.TEXT,
    descripcion: DataTypes.TEXT,
    superficie: DataTypes.BIGINT,
    cantidad_ambientes: DataTypes.BIGINT,
  },
  {
    tableName: "Publicacion",
    timestamps: false,
  }
);

// 🔗 Relaciones
Publicacion.belongsTo(TipoDePropiedad, { foreignKey: "id_tipo_propiedad" });
Publicacion.belongsTo(TipoDeMoneda, { foreignKey: "id_tipo_moneda" });
Publicacion.belongsTo(CategoriaDePropiedad, {
  foreignKey: "id_categoria_propiedad",
});
Publicacion.belongsTo(Usuario, { foreignKey: "id_publisher" });

export default Publicacion;
