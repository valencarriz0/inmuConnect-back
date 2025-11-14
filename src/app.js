import express from "express";
import cors from "cors";

import publicacionRoutes from "./routes/publicacionRoutes.js";
import usuarioRoutes from "./routes/UsuarioRoutes.js";

const app = express();
app.use(cors());
app.use(express.json());

// Rutas

app.use("/api/publicaciones", publicacionRoutes);
app.use("/api/usuarios", usuarioRoutes);

app.listen(3000, () => {
  console.log("🚀 Servidor corriendo en http://localhost:3000");
});

export default app;
