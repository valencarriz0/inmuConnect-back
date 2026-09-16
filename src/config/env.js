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

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret || jwtSecret.trim().length < 32) {
  throw new Error("JWT_SECRET es obligatorio y debe tener al menos 32 caracteres.");
}

const jwtExpiresIn = process.env.JWT_EXPIRES_IN?.trim() ?? "8h";
if (!/^[1-9]\d*(s|m|h|d)$/.test(jwtExpiresIn) || !Number.isSafeInteger(Number(jwtExpiresIn.slice(0, -1)))) {
  throw new Error("JWT_EXPIRES_IN debe ser una duración positiva con unidad s, m, h o d (por ejemplo, 8h).");
}

const nominatimBaseUrl = process.env.NOMINATIM_BASE_URL?.trim();
try {
  const url = new URL(nominatimBaseUrl);
  if (!["http:", "https:"].includes(url.protocol) || !url.hostname) throw new Error();
} catch {
  throw new Error("NOMINATIM_BASE_URL debe ser una URL HTTP válida.");
}

const nominatimUserAgent = process.env.NOMINATIM_USER_AGENT?.trim();
if (!nominatimUserAgent || nominatimUserAgent.length < 10) {
  throw new Error("NOMINATIM_USER_AGENT es obligatorio y debe identificar la aplicación.");
}

const nominatimTimeoutValue = process.env.NOMINATIM_TIMEOUT_MS?.trim();
const nominatimTimeout = Number(nominatimTimeoutValue);
if (!/^\d+$/.test(nominatimTimeoutValue ?? "") || !Number.isInteger(nominatimTimeout) ||
    nominatimTimeout < 100 || nominatimTimeout > 30000) {
  throw new Error("NOMINATIM_TIMEOUT_MS debe ser un entero entre 100 y 30000.");
}

const env = Object.freeze({
  NODE_ENV: process.env.NODE_ENV?.trim() || "development",
  PORT: port,
  DB_CONNECTION_STRING: connectionString,
  DB_SSL: sslValue === "true",
  CORS_ORIGIN: process.env.CORS_ORIGIN?.trim() || "http://localhost:5173",
  JWT_SECRET: jwtSecret,
  JWT_EXPIRES_IN: jwtExpiresIn,
  NOMINATIM_BASE_URL: nominatimBaseUrl.replace(/\/+$/, ""),
  NOMINATIM_USER_AGENT: nominatimUserAgent,
  NOMINATIM_TIMEOUT_MS: nominatimTimeout,
});

export default env;
