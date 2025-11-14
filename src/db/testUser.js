// testUser.js
import sequelize from "../db/sequelize.js";
import Usuario from "../models/Usuario.js";

async function test() {
  try {
    // 1️⃣ Probar conexión
    await sequelize.authenticate();
    console.log("✅ Conexión exitosa a PostgreSQL");

    // 2️⃣ Crear un usuario de prueba
    console.log("\n🧪 Creando usuario de prueba...");
    const nuevoUsuario = await Usuario.createUser({
      tipo: "persona", // 👈 Agregado: 'persona' o 'inmobiliaria'
      nombre: "Juan",
      apellido: "Pérez",
      email: `juan${Date.now()}@mail.com`, // para evitar duplicados
      password: "123456",
      CUIT: "20-12345678-9",
      telefono: "123456789",
      altura: 123,
      calle: "Av. Siempre Viva",
    });

    console.log("✅ Usuario creado correctamente:");
    console.log(JSON.stringify(nuevoUsuario, null, 2));

    // 3️⃣ Mostrar todos los usuarios registrados
    console.log("\n📋 Listando usuarios existentes:");
    const usuarios = await Usuario.findAll({
      attributes: { exclude: ["password"] },
    });

    console.log(JSON.stringify(usuarios, null, 2));
  } catch (error) {
    console.error("❌ Error durante la prueba:", error);
  } finally {
    await sequelize.close();
    console.log("\n🔒 Conexión cerrada.");
  }
}

test();
