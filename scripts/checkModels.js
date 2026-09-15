import sequelize from "../src/config/database.js";
import { Province, City, Service, Amenity } from "../src/models/index.js";

try {
  await sequelize.authenticate();
  for (const model of [Province, City, Service, Amenity]) {
    await model.findAll({ limit: 1, logging: false });
    console.log(`Lectura SELECT correcta: inmobiliaria.${model.tableName}.`);
  }
} catch {
  console.error("No se pudo verificar la lectura de los modelos. Revisá la conexión y el acceso al schema inmobiliaria.");
  process.exitCode = 1;
} finally {
  try {
    await sequelize.close();
  } catch {
    console.error("No se pudo cerrar la conexión de verificación.");
    process.exitCode = 1;
  }
}
