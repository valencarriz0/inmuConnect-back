-- Cambio incremental histórico aplicado sobre la base existente de Supabase.
-- No ejecutar sobre una base reconstruida con 01-04: esa captura ya contiene estos objetos.
ALTER TABLE inmobiliaria.property_views
  ADD COLUMN IF NOT EXISTS user_id uuid;

ALTER TABLE inmobiliaria.property_views
  ADD CONSTRAINT property_views_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES inmobiliaria.users(id)
  ON DELETE SET NULL ON UPDATE NO ACTION;

CREATE INDEX IF NOT EXISTS property_views_user_date
  ON inmobiliaria.property_views USING btree (user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS property_views_property_date
  ON inmobiliaria.property_views USING btree (property_id, created_at DESC);
