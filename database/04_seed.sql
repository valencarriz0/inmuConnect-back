-- Referencia obtenida por SELECT del catálogo de Supabase.
-- Sólo para una base vacía revisada; NO ejecutar sobre la base activa.


-- Los UUID se generan por default; se usan sólo claves naturales.

INSERT INTO inmobiliaria.provinces (country, name) VALUES
  ('Argentina', 'Buenos Aires'),
  ('Argentina', 'Ciudad Autónoma de Buenos Aires'),
  ('Argentina', 'Córdoba'),
  ('Argentina', 'Mendoza'),
  ('Argentina', 'Santa Fe')
ON CONFLICT (country, name) DO NOTHING;

INSERT INTO inmobiliaria.cities (province_id, name)
SELECT p.id, location.city
FROM (VALUES
  ('Argentina', 'Buenos Aires', 'Bahía Blanca'),
  ('Argentina', 'Buenos Aires', 'La Plata'),
  ('Argentina', 'Buenos Aires', 'Mar del Plata'),
  ('Argentina', 'Ciudad Autónoma de Buenos Aires', 'Buenos Aires'),
  ('Argentina', 'Córdoba', 'Córdoba'),
  ('Argentina', 'Córdoba', 'Río Cuarto'),
  ('Argentina', 'Córdoba', 'Villa Carlos Paz'),
  ('Argentina', 'Mendoza', 'Godoy Cruz'),
  ('Argentina', 'Mendoza', 'Mendoza'),
  ('Argentina', 'Mendoza', 'San Rafael'),
  ('Argentina', 'Santa Fe', 'Rafaela'),
  ('Argentina', 'Santa Fe', 'Rosario'),
  ('Argentina', 'Santa Fe', 'Santa Fe')
) AS location(country, province, city)
JOIN inmobiliaria.provinces p
  ON p.country = location.country AND p.name = location.province
ON CONFLICT (province_id, name) DO NOTHING;

INSERT INTO inmobiliaria.services (code, name) VALUES
  ('electricity', 'Luz'),
  ('gas', 'Gas'),
  ('water', 'Agua')
ON CONFLICT (code) DO NOTHING;

INSERT INTO inmobiliaria.amenities (code, name) VALUES
  ('balcony', 'balcón'),
  ('large_patio', 'patio grande')
ON CONFLICT (code) DO NOTHING;
