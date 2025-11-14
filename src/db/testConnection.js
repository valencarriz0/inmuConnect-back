import sequelize from "./sequelize.js";
import Publicacion from "../models/Publicacion.js";

const testConnection = async () => {
  try {
    console.log("🔌 Probando conexión con la base de datos...");
    await sequelize.authenticate();
    console.log("✅ Conexión establecida correctamente.");

    console.log("📦 Obteniendo publicaciones...");
    const publicaciones = await Publicacion.findAll();
    console.log("✅ Publicaciones encontradas:");
    console.log(JSON.stringify(publicaciones, null, 2));
  } catch (error) {
    console.error("❌ Error al conectar o consultar:", error.message);
  } finally {
    await sequelize.close();
  }
};

testConnection();
