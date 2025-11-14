import app from "./app.js";
import sequelize from "./db/sequelize.js";

const PORT = process.env.PORT || 3000;

const startServer = async () => {
  try {
    await sequelize.authenticate();
    console.log("✅ Conexión a la BD exitosa.");
    app.listen(PORT, () => console.log(`🚀 Servidor en puerto ${PORT}`));
  } catch (error) {
    console.error("❌ Error al conectar con la BD:", error);
  }
};

startServer();
