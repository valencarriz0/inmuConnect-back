-- InmuConnect: esquema inicial PostgreSQL/Supabase (PostgreSQL 15+).
-- Ejecutar completo una sola vez sobre una base sin el esquema inmobiliaria.
-- No borra ni reemplaza objetos existentes. No depende de auth.users ni de RLS.
-- Sequelize: schema = 'inmobiliaria'; snake_case; paranoid = false.
-- La BD administra las fechas: mapearlas como atributos y usar timestamps: false.
-- El backend autentica, autoriza, genera password_hash y carga archivos durables.
-- Aprobación: resolver solicitud, crear perfil y cambiar rol en UNA transacción.
-- Publicación: guardar propiedad, imágenes y relaciones en UNA transacción.

BEGIN;

CREATE SCHEMA inmobiliaria;
REVOKE ALL ON SCHEMA inmobiliaria FROM PUBLIC;
SET LOCAL search_path TO inmobiliaria, pg_catalog;

-- gen_random_uuid() es nativa en las versiones de PostgreSQL indicadas.
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    first_name TEXT NOT NULL CHECK (char_length(btrim(first_name)) >= 2),
    last_name TEXT NOT NULL CHECK (char_length(btrim(last_name)) >= 2),
    email TEXT NOT NULL CHECK (email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'),
    phone TEXT CHECK (btrim(phone) <> ''),
    password_hash TEXT NOT NULL CHECK (btrim(password_hash) <> ''),
    role TEXT NOT NULL DEFAULT 'interested'
        CHECK (role IN ('interested', 'publisher', 'admin')),
    account_status TEXT NOT NULL DEFAULT 'active'
        CHECK (account_status IN ('active', 'disabled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT users_publisher_phone CHECK (role <> 'publisher' OR phone IS NOT NULL),
    CONSTRAINT users_dates CHECK (updated_at >= created_at)
);

-- Unicidad también entre Ana@correo.com y ana@correo.com; sin índice duplicado.
CREATE UNIQUE INDEX users_email_unique ON users (lower(email));

-- Snapshot de los datos específicos presentados; una resolución no se reescribe.
-- Los nombres y el correo del solicitante se consultan mediante user_id.
CREATE TABLE publisher_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    publisher_type TEXT NOT NULL CHECK (publisher_type IN ('individual', 'agency')),
    tax_id VARCHAR(11) NOT NULL CHECK (tax_id ~ '^[0-9]{11}$'),
    agency_name TEXT,
    phone TEXT NOT NULL CHECK (btrim(phone) <> ''),
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_at TIMESTAMPTZ,
    reviewed_by UUID REFERENCES users(id) ON DELETE RESTRICT,
    rejection_reason TEXT CHECK (btrim(rejection_reason) <> ''),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT applications_agency_name CHECK (
        (publisher_type = 'individual' AND agency_name IS NULL)
        OR (publisher_type = 'agency' AND agency_name IS NOT NULL AND btrim(agency_name) <> '')
    ),
    CONSTRAINT applications_resolution CHECK (
        (status = 'pending' AND reviewed_at IS NULL AND reviewed_by IS NULL AND rejection_reason IS NULL)
        OR (status IN ('approved', 'rejected') AND reviewed_at IS NOT NULL AND reviewed_by IS NOT NULL
            AND reviewed_at >= created_at AND reviewed_by <> user_id
            AND (status = 'rejected' OR rejection_reason IS NULL))
    ),
    CONSTRAINT applications_dates CHECK (updated_at >= created_at)
);

-- Se puede volver a solicitar después de un rechazo, sin perder el historial.
-- Una aprobación es definitiva; para deshabilitar se usa users.account_status.
CREATE UNIQUE INDEX applications_one_open_or_approved
    ON publisher_applications (user_id) WHERE status IN ('pending', 'approved');
CREATE INDEX applications_user_date ON publisher_applications (user_id, created_at DESC);
CREATE INDEX applications_pending_date ON publisher_applications (created_at) WHERE status = 'pending';
CREATE INDEX applications_reviewer ON publisher_applications (reviewed_by) WHERE reviewed_by IS NOT NULL;

-- Perfil vigente, creado al aprobar. Los snapshots anteriores no cambian al editarlo.
-- No se duplica el teléfono del usuario ni el estado de aprobación de la solicitud.
CREATE TABLE publisher_profiles (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE RESTRICT,
    publisher_type TEXT NOT NULL CHECK (publisher_type IN ('individual', 'agency')),
    tax_id VARCHAR(11) NOT NULL CHECK (tax_id ~ '^[0-9]{11}$'),
    agency_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT profiles_agency_name CHECK (
        (publisher_type = 'individual' AND agency_name IS NULL)
        OR (publisher_type = 'agency' AND agency_name IS NOT NULL AND btrim(agency_name) <> '')
    ),
    CONSTRAINT profiles_dates CHECK (updated_at >= created_at)
);

-- Catálogos geográficos actuales: constants/locations.ts y país del formulario.
-- La propiedad guarda city_id; provincia y país se obtienen por relación.
CREATE TABLE provinces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    country TEXT NOT NULL DEFAULT 'Argentina' CHECK (btrim(country) <> ''),
    name TEXT NOT NULL CHECK (btrim(name) <> ''),
    CONSTRAINT provinces_country_name_unique UNIQUE (country, name)
);

CREATE TABLE cities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    province_id UUID NOT NULL REFERENCES provinces(id) ON DELETE RESTRICT,
    name TEXT NOT NULL CHECK (btrim(name) <> ''),
    CONSTRAINT cities_province_name_unique UNIQUE (province_id, name)
);

CREATE TABLE services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE CHECK (btrim(code) <> ''),
    name TEXT NOT NULL CHECK (btrim(name) <> '')
);

CREATE TABLE amenities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE CHECK (btrim(code) <> ''),
    name TEXT NOT NULL CHECK (btrim(name) <> '')
);

CREATE TABLE properties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    publisher_id UUID NOT NULL REFERENCES publisher_profiles(user_id) ON DELETE RESTRICT,
    title TEXT NOT NULL CHECK (btrim(title) <> ''),
    description TEXT NOT NULL CHECK (btrim(description) <> ''),
    operation_type TEXT NOT NULL CHECK (operation_type IN ('sale', 'rent', 'temporary_rent')),
    property_type TEXT NOT NULL CHECK (property_type IN ('house', 'apartment', 'land', 'commercial')),
    price NUMERIC(16,2) NOT NULL CHECK (price > 0 AND price <> 'NaN'::NUMERIC),
    currency VARCHAR(3) NOT NULL CHECK (currency IN ('ARS', 'USD')),
    city_id UUID NOT NULL REFERENCES cities(id) ON DELETE RESTRICT,
    street TEXT CHECK (btrim(street) <> ''),
    street_number INTEGER CHECK (street_number >= 0),
    total_area NUMERIC(14,2) NOT NULL CHECK (total_area > 0 AND total_area <> 'NaN'::NUMERIC),
    rooms SMALLINT NOT NULL CHECK (rooms > 0),
    bedrooms SMALLINT CHECK (bedrooms >= 0),
    bathrooms SMALLINT CHECK (bathrooms >= 0),
    age SMALLINT CHECK (age >= 0),
    property_condition TEXT CHECK (property_condition IN ('new', 'excellent', 'good', 'to-renovate')),
    accepts_pets BOOLEAN,
    garage SMALLINT CHECK (garage >= 0),
    expenses NUMERIC(16,2) CHECK (expenses >= 0 AND expenses <> 'NaN'::NUMERIC),
    taxes NUMERIC(16,2) CHECK (taxes >= 0 AND taxes <> 'NaN'::NUMERIC),
    commissions NUMERIC(16,2) CHECK (commissions >= 0 AND commissions <> 'NaN'::NUMERIC),
    publication_status TEXT NOT NULL DEFAULT 'active'
        CHECK (publication_status IN ('active', 'paused', 'deleted')),
    latitude NUMERIC(9,6) CHECK (latitude BETWEEN -90 AND 90),
    longitude NUMERIC(9,6) CHECK (longitude BETWEEN -180 AND 180),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT properties_coordinates_pair CHECK ((latitude IS NULL) = (longitude IS NULL)),
    CONSTRAINT properties_dates CHECK (updated_at >= created_at)
);

COMMENT ON COLUMN properties.commissions IS 'Importe, no porcentaje; usa properties.currency, igual que expensas e impuestos.';
COMMENT ON COLUMN properties.publication_status IS 'Único mecanismo de eliminación lógica. No hay deleted_at ni Sequelize paranoid.';
COMMENT ON COLUMN properties.accepts_pets IS 'NULL = no especificado; false = no acepta; true = acepta.';

CREATE TABLE property_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    url TEXT NOT NULL CHECK (btrim(url) <> '' AND url !~* '^[[:space:]]*(blob:|data:)'),
    position SMALLINT NOT NULL CHECK (position BETWEEN 0 AND 4),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT property_images_position_unique UNIQUE (property_id, position)
        DEFERRABLE INITIALLY DEFERRED
);

COMMENT ON COLUMN property_images.url IS 'URL durable o path del archivo. MIME y límite de 5 MB se validan al cargarlo en el backend.';
COMMENT ON COLUMN property_images.position IS 'Orden contiguo desde 0. La posición 0 es la portada. Entre 2 y 5 imágenes al confirmar la transacción.';

-- Las PK compuestas garantizan unicidad de cada relación, sin índices redundantes.
CREATE TABLE property_services (
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
    PRIMARY KEY (property_id, service_id)
);

CREATE TABLE property_amenities (
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    amenity_id UUID NOT NULL REFERENCES amenities(id) ON DELETE RESTRICT,
    PRIMARY KEY (property_id, amenity_id)
);

CREATE TABLE favorites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT favorites_user_property_unique UNIQUE (user_id, property_id)
);

-- Contacto independiente del perfil: no se actualiza al modificar users.
-- La propiedad y su publicador se conservan; no duplicamos publisher_id/título/portada.
CREATE TABLE consultations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    first_name TEXT NOT NULL CHECK (char_length(btrim(first_name)) >= 2),
    last_name TEXT NOT NULL CHECK (char_length(btrim(last_name)) >= 2),
    email TEXT NOT NULL CHECK (email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'),
    phone TEXT NOT NULL CHECK (btrim(phone) <> ''),
    message TEXT CHECK (btrim(message) <> ''),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Una fila por apertura pública contabilizada por el backend; no por tarjeta/render.
-- Son visitas totales, no visitantes únicos. No hace falta identificar al visitante.
CREATE TABLE property_views (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('new_consultation', 'publisher_approved', 'publisher_rejected')),
    title TEXT NOT NULL CHECK (btrim(title) <> ''),
    message TEXT CHECK (btrim(message) <> ''),
    consultation_id UUID REFERENCES consultations(id) ON DELETE SET NULL,
    publisher_application_id UUID REFERENCES publisher_applications(id) ON DELETE RESTRICT,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT notifications_reference_type CHECK (
        (type = 'new_consultation' AND publisher_application_id IS NULL)
        OR (type IN ('publisher_approved', 'publisher_rejected') AND consultation_id IS NULL)
    ),
    CONSTRAINT notifications_read_date CHECK (read_at IS NULL OR read_at >= created_at)
);

COMMENT ON COLUMN notifications.read_at IS 'NULL = no leída. Evita duplicar estado mediante is_read.';

-- Índices de lectura; las PK y UNIQUE ya cubren sus columnas iniciales.
CREATE INDEX properties_publisher_status ON properties (publisher_id, publication_status);
CREATE INDEX properties_city_status ON properties (city_id, publication_status);
CREATE INDEX properties_active_operation ON properties (operation_type) WHERE publication_status = 'active';
CREATE INDEX properties_active_type ON properties (property_type) WHERE publication_status = 'active';
CREATE INDEX properties_active_price ON properties (currency, price) WHERE publication_status = 'active';
CREATE INDEX property_services_service ON property_services (service_id);
CREATE INDEX property_amenities_amenity ON property_amenities (amenity_id);
CREATE INDEX favorites_property ON favorites (property_id);
CREATE INDEX consultations_property_date ON consultations (property_id, created_at DESC);
CREATE INDEX consultations_user_date ON consultations (user_id, created_at DESC) WHERE user_id IS NOT NULL;
CREATE INDEX property_views_property_date ON property_views (property_id, created_at DESC);
CREATE INDEX notifications_user_date ON notifications (user_id, created_at DESC);
CREATE INDEX notifications_unread_user ON notifications (user_id, created_at DESC) WHERE read_at IS NULL;
CREATE INDEX notifications_consultation ON notifications (consultation_id) WHERE consultation_id IS NOT NULL;
CREATE INDEX notifications_application ON notifications (publisher_application_id) WHERE publisher_application_id IS NOT NULL;

-- Una sola función para las tablas que tienen updated_at.
CREATE FUNCTION set_updated_at() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = inmobiliaria, pg_catalog AS $$
BEGIN
    NEW.created_at := OLD.created_at;
    NEW.updated_at := GREATEST(clock_timestamp(), OLD.updated_at + INTERVAL '1 millisecond');
    RETURN NEW;
END;
$$;

CREATE TRIGGER users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON publisher_profiles
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER applications_updated_at BEFORE UPDATE ON publisher_applications
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER properties_updated_at BEFORE UPDATE ON properties
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Las solicitudes nacen pendientes; solo se cambia su resolución una vez.
-- Comprobar el rol del revisor no sustituye autenticar al actor en el backend.
CREATE FUNCTION guard_publisher_application() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = inmobiliaria, pg_catalog AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Las solicitudes se conservan como historial.' USING ERRCODE = '23514';
    ELSIF TG_OP = 'INSERT' THEN
        IF NEW.status <> 'pending' THEN
            RAISE EXCEPTION 'La solicitud debe comenzar pendiente.' USING ERRCODE = '23514';
        END IF;
        PERFORM 1 FROM users WHERE id = NEW.user_id AND role = 'interested' AND account_status = 'active' FOR SHARE;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'El solicitante debe ser un interesado activo.' USING ERRCODE = '23514';
        END IF;
    ELSE
        IF OLD.status <> 'pending' OR
           ROW(NEW.id, NEW.user_id, NEW.publisher_type, NEW.tax_id, NEW.agency_name, NEW.phone)
           IS DISTINCT FROM ROW(OLD.id, OLD.user_id, OLD.publisher_type, OLD.tax_id, OLD.agency_name, OLD.phone) THEN
            RAISE EXCEPTION 'No se puede reescribir una solicitud ni su resolución.' USING ERRCODE = '23514';
        END IF;
    END IF;
    IF NEW.status IN ('approved', 'rejected') THEN
        PERFORM 1 FROM users WHERE id = NEW.reviewed_by AND role = 'admin' AND account_status = 'active' FOR SHARE;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'La resolución requiere un administrador activo.' USING ERRCODE = '23514';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER applications_guard BEFORE INSERT OR UPDATE OR DELETE ON publisher_applications
    FOR EACH ROW EXECUTE FUNCTION guard_publisher_application();

-- Al COMMIT deben coincidir rol publisher, perfil y una solicitud aprobada.
-- Permite al backend realizar los tres cambios en cualquier orden transaccional.
CREATE FUNCTION check_publisher_consistency() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = inmobiliaria, pg_catalog AS $$
DECLARE
    target_ids UUID[];
    target_id UUID;
    current_role TEXT;
    has_profile BOOLEAN;
    is_approved BOOLEAN;
BEGIN
    IF TG_TABLE_NAME = 'users' THEN
        target_ids := ARRAY[NEW.id, OLD.id];
    ELSE
        target_ids := ARRAY[NEW.user_id, OLD.user_id];
    END IF;
    FOR target_id IN SELECT DISTINCT unnest(target_ids) LOOP
        SELECT role INTO current_role FROM users WHERE id = target_id;
        IF NOT FOUND THEN CONTINUE; END IF;
        SELECT EXISTS (SELECT 1 FROM publisher_profiles WHERE user_id = target_id),
               EXISTS (SELECT 1 FROM publisher_applications WHERE user_id = target_id AND status = 'approved')
          INTO has_profile, is_approved;
        IF (current_role = 'publisher') IS DISTINCT FROM has_profile
           OR has_profile IS DISTINCT FROM is_approved THEN
            RAISE EXCEPTION 'Rol, perfil y aprobación de publicador inconsistentes para %.', target_id USING ERRCODE = '23514';
        END IF;
    END LOOP;
    RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER users_publisher_consistency AFTER INSERT OR UPDATE ON users
    DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_publisher_consistency();
CREATE CONSTRAINT TRIGGER profiles_publisher_consistency AFTER INSERT OR UPDATE OR DELETE ON publisher_profiles
    DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_publisher_consistency();
CREATE CONSTRAINT TRIGGER applications_publisher_consistency AFTER INSERT OR UPDATE ON publisher_applications
    DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_publisher_consistency();

-- El frontend no transfiere publicaciones ni permite restaurar las eliminadas.
-- Mantener el publicador original permite consultar el historial sin duplicarlo.
CREATE FUNCTION guard_property() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = inmobiliaria, pg_catalog AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        IF NEW.id <> OLD.id OR NEW.publisher_id <> OLD.publisher_id OR OLD.publication_status = 'deleted' THEN
            RAISE EXCEPTION 'La identidad y el publicador son inmutables; una publicación eliminada no se modifica.' USING ERRCODE = '23514';
        END IF;
    END IF;
    IF TG_OP = 'INSERT' OR (NEW.publication_status = 'active' AND OLD.publication_status <> 'active') THEN
        PERFORM 1 FROM users WHERE id = NEW.publisher_id AND role = 'publisher' AND account_status = 'active' FOR SHARE;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Publicar o reactivar requiere un publicador activo.' USING ERRCODE = '23514';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER properties_guard BEFORE INSERT OR UPDATE ON properties
    FOR EACH ROW EXECUTE FUNCTION guard_property();

-- Actualiza la fecha de la publicación cuando cambia su galería o sus relaciones.
-- La escritura del padre serializa ediciones concurrentes de la misma galería.
CREATE FUNCTION touch_related_property() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = inmobiliaria, pg_catalog AS $$
BEGIN
    IF TG_OP = 'UPDATE' AND NEW.property_id <> OLD.property_id THEN
        RAISE EXCEPTION 'No se puede transferir esta relación a otra propiedad.' USING ERRCODE = '23514';
    END IF;
    UPDATE properties SET updated_at = updated_at
      WHERE id = CASE WHEN TG_OP = 'DELETE' THEN OLD.property_id ELSE NEW.property_id END;
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER images_touch_property BEFORE INSERT OR UPDATE OR DELETE ON property_images
    FOR EACH ROW EXECUTE FUNCTION touch_related_property();
CREATE TRIGGER services_touch_property BEFORE INSERT OR UPDATE OR DELETE ON property_services
    FOR EACH ROW EXECUTE FUNCTION touch_related_property();
CREATE TRIGGER amenities_touch_property BEFORE INSERT OR UPDATE OR DELETE ON property_amenities
    FOR EACH ROW EXECUTE FUNCTION touch_related_property();

-- Restricción entre filas: se comprueba al terminar la transacción, no al cargar
-- la primera imagen. Permite reemplazar y reordenar una galería en forma atómica.
CREATE FUNCTION check_property_images() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = inmobiliaria, pg_catalog AS $$
DECLARE
    target_id UUID;
    image_count INTEGER;
    first_position INTEGER;
    last_position INTEGER;
BEGIN
    IF TG_TABLE_NAME = 'properties' THEN target_id := NEW.id;
    ELSIF TG_OP = 'DELETE' THEN target_id := OLD.property_id;
    ELSE target_id := NEW.property_id;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM properties WHERE id = target_id) THEN RETURN NULL; END IF;
    SELECT count(*), min(position), max(position)
      INTO image_count, first_position, last_position
      FROM property_images WHERE property_id = target_id;
    IF image_count NOT BETWEEN 2 AND 5 OR first_position <> 0 OR last_position <> image_count - 1 THEN
        RAISE EXCEPTION 'La propiedad % requiere entre 2 y 5 imágenes en posiciones contiguas desde 0.', target_id USING ERRCODE = '23514';
    END IF;
    RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER properties_images_required AFTER INSERT ON properties
    DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_property_images();
CREATE CONSTRAINT TRIGGER images_valid_gallery AFTER INSERT OR UPDATE OR DELETE ON property_images
    DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_property_images();

-- Un favorito o una consulta registrada requieren una propiedad ajena.
-- Las consultas anónimas conservan todos sus datos de contacto obligatorios.
CREATE FUNCTION guard_property_interaction() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = inmobiliaria, pg_catalog AS $$
DECLARE
    owner_id UUID;
BEGIN
    SELECT publisher_id INTO owner_id FROM properties
      WHERE id = NEW.property_id AND publication_status = 'active' FOR SHARE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'La propiedad no está disponible públicamente.' USING ERRCODE = '23514';
    END IF;
    IF TG_TABLE_NAME <> 'property_views' THEN
        IF NEW.user_id IS NOT NULL THEN
            PERFORM 1 FROM users WHERE id = NEW.user_id
                AND role IN ('interested', 'publisher') AND account_status = 'active' FOR SHARE;
            IF NOT FOUND OR NEW.user_id = owner_id THEN
                RAISE EXCEPTION 'Se requiere un interesado o publicador activo y una propiedad ajena.' USING ERRCODE = '23514';
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER favorites_guard BEFORE INSERT OR UPDATE ON favorites
    FOR EACH ROW EXECUTE FUNCTION guard_property_interaction();
CREATE TRIGGER consultations_guard BEFORE INSERT ON consultations
    FOR EACH ROW EXECUTE FUNCTION guard_property_interaction();
CREATE TRIGGER views_guard BEFORE INSERT ON property_views
    FOR EACH ROW EXECUTE FUNCTION guard_property_interaction();

-- Vista calculada, no tabla de estadísticas ni contador persistido.
-- Agregar visitas y consultas por separado evita multiplicarlas por un JOIN.
-- Como publisherStatistics(): incluye activas/pausadas y excluye eliminadas.
CREATE VIEW property_metrics AS
SELECT p.id AS property_id, p.publisher_id, p.title, p.publication_status,
       COALESCE(v.views, 0::BIGINT) AS views,
       COALESCE(c.consultations, 0::BIGINT) AS consultations
FROM properties p
LEFT JOIN (
    SELECT property_id, count(*) AS views FROM property_views GROUP BY property_id
) v ON v.property_id = p.id
LEFT JOIN (
    SELECT property_id, count(*) AS consultations FROM consultations GROUP BY property_id
) c ON c.property_id = p.id
WHERE p.publication_status IN ('active', 'paused');

-- Solo catálogos existentes. No se insertan usuarios, propiedades ni actividad.
INSERT INTO services (code, name) VALUES
    ('electricity', 'Luz'), ('gas', 'Gas'), ('water', 'Agua');
INSERT INTO amenities (code, name) VALUES
    ('large_patio', 'patio grande'), ('balcony', 'balcón');
INSERT INTO provinces (country, name) VALUES
    ('Argentina', 'Buenos Aires'),
    ('Argentina', 'Ciudad Autónoma de Buenos Aires'),
    ('Argentina', 'Córdoba'),
    ('Argentina', 'Mendoza'),
    ('Argentina', 'Santa Fe');
INSERT INTO cities (province_id, name)
SELECT p.id, seed.city
FROM (VALUES
    ('Buenos Aires', 'La Plata'),
    ('Buenos Aires', 'Mar del Plata'),
    ('Buenos Aires', 'Bahía Blanca'),
    ('Ciudad Autónoma de Buenos Aires', 'Buenos Aires'),
    ('Córdoba', 'Córdoba'),
    ('Córdoba', 'Villa Carlos Paz'),
    ('Córdoba', 'Río Cuarto'),
    ('Mendoza', 'Mendoza'),
    ('Mendoza', 'Godoy Cruz'),
    ('Mendoza', 'San Rafael'),
    ('Santa Fe', 'Rosario'),
    ('Santa Fe', 'Santa Fe'),
    ('Santa Fe', 'Rafaela')
) AS seed(province, city)
JOIN provinces p ON p.name = seed.province AND p.country = 'Argentina';

-- Acceso SQL mediante la cuenta del backend; este esquema no se expone a la
-- Data API. No se conceden permisos a clientes anónimos ni se habilita RLS.
REVOKE ALL ON ALL TABLES IN SCHEMA inmobiliaria FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA inmobiliaria FROM PUBLIC;

COMMIT;
