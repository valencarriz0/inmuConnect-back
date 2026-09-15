import env from "./config/env.js";
import sequelize from "./config/database.js";
import "./models/index.js";
import app from "./app.js";

try {
  await sequelize.authenticate();
  console.log("Conexión a PostgreSQL exitosa.");

  await new Promise((resolve, reject) => {
    const server = app.listen(env.PORT, resolve);
    server.once("error", reject);
  });
  console.log(`Servidor iniciado en el puerto ${env.PORT}.`);
} catch {
  console.error(
    "No se pudo iniciar el servidor. Revisá la conexión a PostgreSQL, la configuración SSL y la disponibilidad del puerto."
  );

  try {
    await sequelize.close();
  } catch {
    console.error("No se pudo cerrar la conexión a PostgreSQL.");
  }
  process.exitCode = 1;
}
