import env from "./config/env.js";
import sequelize from "./config/database.js";
import app from "./app.js";

try {
  await sequelize.authenticate();
  console.log("Conexión a PostgreSQL exitosa.");

  await new Promise((resolve, reject) => {
    const server = app.listen(env.PORT, resolve);
    server.once("error", reject);
  });
  console.log(`Servidor iniciado en el puerto ${env.PORT}.`);
} catch (error) {
  console.error(
    "No se pudo iniciar el servidor. Revisá la conexión a PostgreSQL, la configuración SSL y la disponibilidad del puerto."
  );

  console.error("Tipo:", error.name);
  console.error("Mensaje:", error.message);
  console.error(
    "Código:",
    error.original?.code ?? error.parent?.code ?? error.code ?? "sin código"
  );

  process.exit(1);
}
