import dotenv from "dotenv";

dotenv.config();

const connectionString = process.env.DB_CONNECTION_STRING?.trim();
if (!connectionString) {
  throw new Error("DB_CONNECTION_STRING es obligatoria. Configurala en .env o en el entorno.");
}

try {
  const url = new URL(connectionString);
  if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname) {
    throw new Error();
  }
} catch {
  throw new Error("DB_CONNECTION_STRING debe ser una URL válida de PostgreSQL.");
}

const portValue = process.env.PORT?.trim() ?? "3000";
const port = Number(portValue);
if (!/^\d+$/.test(portValue) || !Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT debe ser un entero entre 1 y 65535.");
}

const sslValue = (process.env.DB_SSL ?? "true").trim().toLowerCase();
if (!["true", "false"].includes(sslValue)) {
  throw new Error("DB_SSL debe ser true o false.");
}

const env = Object.freeze({
  NODE_ENV: process.env.NODE_ENV?.trim() || "development",
  PORT: port,
  DB_CONNECTION_STRING: connectionString,
  DB_SSL: sslValue === "true",
  CORS_ORIGIN: process.env.CORS_ORIGIN?.trim() || "http://localhost:5173",
});

export default env;
