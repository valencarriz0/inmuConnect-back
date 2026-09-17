-- Cambio incremental histórico aplicado sobre la base original.
-- No ejecutar sobre una base reconstruida con 01-04: esa captura ya contiene estos objetos.
-- Conserva las cuentas existentes como verificadas para no bloquear sesiones ya creadas.

ALTER TABLE inmobiliaria.users ADD COLUMN IF NOT EXISTS email_verified_at timestamp with time zone;
ALTER TABLE inmobiliaria.users ADD COLUMN IF NOT EXISTS auth_version integer NOT NULL DEFAULT 0;
UPDATE inmobiliaria.users SET email_verified_at = created_at WHERE email_verified_at IS NULL;
ALTER TABLE inmobiliaria.users DROP CONSTRAINT IF EXISTS users_auth_version_check;
ALTER TABLE inmobiliaria.users ADD CONSTRAINT users_auth_version_check CHECK (auth_version >= 0);

CREATE TABLE IF NOT EXISTS inmobiliaria.auth_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES inmobiliaria.users(id) ON DELETE CASCADE,
  purpose text NOT NULL CHECK (purpose IN ('email_verification', 'password_reset')),
  token_hash text NOT NULL UNIQUE,
  expires_at timestamp with time zone NOT NULL,
  used_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT auth_tokens_expiry_check CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS auth_tokens_user_purpose_active
  ON inmobiliaria.auth_tokens (user_id, purpose, expires_at) WHERE used_at IS NULL;
