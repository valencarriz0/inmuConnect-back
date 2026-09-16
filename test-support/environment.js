import dotenv from "dotenv";

// Las pruebas nunca cargan el .env local ni sus credenciales.
dotenv.config = () => ({ parsed: {} });
process.env.NODE_ENV = "test";
process.env.PORT = "3000";
process.env.DB_CONNECTION_STRING = "postgresql://test:test@localhost:5432/test";
process.env.DB_SSL = "false";
process.env.CORS_ORIGIN = "http://localhost:5173";
process.env.JWT_SECRET = "test-only-fake-secret-never-use-in-production";
process.env.JWT_EXPIRES_IN = "8h";
process.env.NOMINATIM_BASE_URL = "https://nominatim.test";
process.env.NOMINATIM_USER_AGENT = "InmuConnect-tests/1.0";
process.env.NOMINATIM_TIMEOUT_MS = "5000";
process.env.SUPABASE_URL = "https://project.test";
process.env.SUPABASE_SECRET_KEY = "test-placeholder-secret";
process.env.SUPABASE_STORAGE_BUCKET = "property-images";
