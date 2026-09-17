-- Referencia obtenida por SELECT del catálogo de Supabase.
-- Sólo para una base vacía revisada; NO ejecutar sobre la base activa.


CREATE SCHEMA inmobiliaria;

CREATE TABLE inmobiliaria.users (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "first_name" text NOT NULL,
  "last_name" text NOT NULL,
  "email" text NOT NULL,
  "phone" text,
  "password_hash" text NOT NULL,
  "role" text NOT NULL DEFAULT 'interested'::text,
  "account_status" text NOT NULL DEFAULT 'active'::text,
  "email_verified_at" timestamp with time zone,
  "auth_version" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "users_pkey" PRIMARY KEY (id)
);

CREATE TABLE inmobiliaria.auth_tokens (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL,
  "purpose" text NOT NULL,
  "token_hash" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "used_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "auth_tokens_pkey" PRIMARY KEY (id)
);

CREATE TABLE inmobiliaria.publisher_applications (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL,
  "publisher_type" text NOT NULL,
  "tax_id" character varying(11) NOT NULL,
  "agency_name" text,
  "phone" text NOT NULL,
  "status" text NOT NULL DEFAULT 'pending'::text,
  "reviewed_at" timestamp with time zone,
  "reviewed_by" uuid,
  "rejection_reason" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "publisher_applications_pkey" PRIMARY KEY (id)
);

CREATE TABLE inmobiliaria.publisher_profiles (
  "user_id" uuid NOT NULL,
  "publisher_type" text NOT NULL,
  "tax_id" character varying(11) NOT NULL,
  "agency_name" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "publisher_profiles_pkey" PRIMARY KEY (user_id)
);

CREATE TABLE inmobiliaria.provinces (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "country" text NOT NULL DEFAULT 'Argentina'::text,
  "name" text NOT NULL,
  CONSTRAINT "provinces_pkey" PRIMARY KEY (id)
);

CREATE TABLE inmobiliaria.cities (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "province_id" uuid NOT NULL,
  "name" text NOT NULL,
  CONSTRAINT "cities_pkey" PRIMARY KEY (id)
);

CREATE TABLE inmobiliaria.services (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "code" text NOT NULL,
  "name" text NOT NULL,
  CONSTRAINT "services_pkey" PRIMARY KEY (id)
);

CREATE TABLE inmobiliaria.amenities (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "code" text NOT NULL,
  "name" text NOT NULL,
  CONSTRAINT "amenities_pkey" PRIMARY KEY (id)
);

CREATE TABLE inmobiliaria.properties (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "publisher_id" uuid NOT NULL,
  "title" text NOT NULL,
  "description" text NOT NULL,
  "operation_type" text NOT NULL,
  "property_type" text NOT NULL,
  "price" numeric(16,2) NOT NULL,
  "currency" character varying(3) NOT NULL,
  "city_id" uuid NOT NULL,
  "street" text,
  "street_number" character varying(30),
  "total_area" numeric(14,2) NOT NULL,
  "rooms" smallint NOT NULL,
  "bedrooms" smallint,
  "bathrooms" smallint,
  "age" smallint,
  "property_condition" text,
  "accepts_pets" boolean,
  "garage" smallint,
  "expenses" numeric(16,2),
  "taxes" numeric(16,2),
  "commissions" numeric(16,2),
  "publication_status" text NOT NULL DEFAULT 'active'::text,
  "latitude" numeric(9,6),
  "longitude" numeric(9,6),
  "created_at" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "properties_pkey" PRIMARY KEY (id)
);

CREATE TABLE inmobiliaria.property_images (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "property_id" uuid NOT NULL,
  "url" text NOT NULL,
  "position" smallint NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "property_images_pkey" PRIMARY KEY (id)
);

CREATE TABLE inmobiliaria.property_services (
  "property_id" uuid NOT NULL,
  "service_id" uuid NOT NULL,
  CONSTRAINT "property_services_pkey" PRIMARY KEY (property_id, service_id)
);

CREATE TABLE inmobiliaria.property_amenities (
  "property_id" uuid NOT NULL,
  "amenity_id" uuid NOT NULL,
  CONSTRAINT "property_amenities_pkey" PRIMARY KEY (property_id, amenity_id)
);

CREATE TABLE inmobiliaria.favorites (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL,
  "property_id" uuid NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "favorites_pkey" PRIMARY KEY (id)
);

CREATE TABLE inmobiliaria.consultations (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "property_id" uuid NOT NULL,
  "user_id" uuid,
  "first_name" text NOT NULL,
  "last_name" text NOT NULL,
  "email" text NOT NULL,
  "phone" text NOT NULL,
  "message" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "consultations_pkey" PRIMARY KEY (id)
);

CREATE TABLE inmobiliaria.property_views (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "property_id" uuid NOT NULL,
  "user_id" uuid,
  "created_at" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "property_views_pkey" PRIMARY KEY (id)
);

CREATE TABLE inmobiliaria.search_alerts (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL,
  "name" text,
  "operation_type" text,
  "property_type" text,
  "province_id" uuid,
  "city_id" uuid,
  "currency" character varying(3),
  "min_price" numeric(16,2),
  "max_price" numeric(16,2),
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "search_alerts_pkey" PRIMARY KEY (id)
);

CREATE TABLE inmobiliaria.property_change_history (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "property_id" uuid NOT NULL,
  "changed_by" uuid,
  "action" text NOT NULL,
  "previous_data" jsonb,
  "new_data" jsonb,
  "created_at" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "property_change_history_pkey" PRIMARY KEY (id)
);

CREATE TABLE inmobiliaria.notifications (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL,
  "type" text NOT NULL,
  "title" text NOT NULL,
  "message" text,
  "consultation_id" uuid,
  "publisher_application_id" uuid,
  "search_alert_id" uuid,
  "property_id" uuid,
  "read_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notifications_pkey" PRIMARY KEY (id)
);
