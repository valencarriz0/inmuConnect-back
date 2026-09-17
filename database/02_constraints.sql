-- Referencia obtenida por SELECT del catálogo de Supabase.
-- Sólo para una base vacía revisada; NO ejecutar sobre la base activa.


ALTER TABLE inmobiliaria.amenities
  ADD CONSTRAINT "amenities_code_key" UNIQUE (code);

ALTER TABLE inmobiliaria.cities
  ADD CONSTRAINT "cities_province_name_unique" UNIQUE (province_id, name);

ALTER TABLE inmobiliaria.favorites
  ADD CONSTRAINT "favorites_user_property_unique" UNIQUE (user_id, property_id);

ALTER TABLE inmobiliaria.property_views
  ADD CONSTRAINT "property_views_user_id_fkey" FOREIGN KEY (user_id) REFERENCES inmobiliaria.users(id) ON DELETE SET NULL ON UPDATE NO ACTION;

ALTER TABLE inmobiliaria.property_images
  ADD CONSTRAINT "property_images_position_unique" UNIQUE (property_id, "position");

ALTER TABLE inmobiliaria.provinces
  ADD CONSTRAINT "provinces_country_name_unique" UNIQUE (country, name);

ALTER TABLE inmobiliaria.publisher_profiles
  ADD CONSTRAINT "publisher_profiles_tax_id_key" UNIQUE (tax_id);

ALTER TABLE inmobiliaria.services
  ADD CONSTRAINT "services_code_key" UNIQUE (code);

ALTER TABLE inmobiliaria.amenities
  ADD CONSTRAINT "amenities_code_check" CHECK (btrim(code) <> ''::text);

ALTER TABLE inmobiliaria.amenities
  ADD CONSTRAINT "amenities_name_check" CHECK (btrim(name) <> ''::text);

ALTER TABLE inmobiliaria.cities
  ADD CONSTRAINT "cities_name_check" CHECK (btrim(name) <> ''::text);

ALTER TABLE inmobiliaria.consultations
  ADD CONSTRAINT "consultations_email_check" CHECK (email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'::text);

ALTER TABLE inmobiliaria.consultations
  ADD CONSTRAINT "consultations_first_name_check" CHECK (char_length(btrim(first_name)) >= 2);

ALTER TABLE inmobiliaria.consultations
  ADD CONSTRAINT "consultations_last_name_check" CHECK (char_length(btrim(last_name)) >= 2);

ALTER TABLE inmobiliaria.consultations
  ADD CONSTRAINT "consultations_message_check" CHECK (message IS NULL OR btrim(message) <> ''::text);

ALTER TABLE inmobiliaria.consultations
  ADD CONSTRAINT "consultations_phone_check" CHECK (btrim(phone) <> ''::text);

ALTER TABLE inmobiliaria.notifications
  ADD CONSTRAINT "notifications_message_check" CHECK (message IS NULL OR btrim(message) <> ''::text);

ALTER TABLE inmobiliaria.notifications
  ADD CONSTRAINT "notifications_read_date" CHECK (read_at IS NULL OR read_at >= created_at);

ALTER TABLE inmobiliaria.notifications
  ADD CONSTRAINT "notifications_reference_type" CHECK (type = 'new_consultation'::text AND consultation_id IS NOT NULL AND publisher_application_id IS NULL AND search_alert_id IS NULL AND property_id IS NULL OR (type = ANY (ARRAY['publisher_approved'::text, 'publisher_rejected'::text])) AND publisher_application_id IS NOT NULL AND consultation_id IS NULL AND search_alert_id IS NULL AND property_id IS NULL OR type = 'new_property_match'::text AND search_alert_id IS NOT NULL AND property_id IS NOT NULL AND consultation_id IS NULL AND publisher_application_id IS NULL);

ALTER TABLE inmobiliaria.notifications
  ADD CONSTRAINT "notifications_title_check" CHECK (btrim(title) <> ''::text);

ALTER TABLE inmobiliaria.notifications
  ADD CONSTRAINT "notifications_type_check" CHECK (type = ANY (ARRAY['new_consultation'::text, 'publisher_approved'::text, 'publisher_rejected'::text, 'new_property_match'::text]));

ALTER TABLE inmobiliaria.properties
  ADD CONSTRAINT "properties_age_check" CHECK (age >= 0);

ALTER TABLE inmobiliaria.properties
  ADD CONSTRAINT "properties_bathrooms_check" CHECK (bathrooms >= 0);

ALTER TABLE inmobiliaria.properties
  ADD CONSTRAINT "properties_bedrooms_check" CHECK (bedrooms >= 0);

ALTER TABLE inmobiliaria.properties
  ADD CONSTRAINT "properties_commissions_check" CHECK (commissions >= 0::numeric);

ALTER TABLE inmobiliaria.properties
  ADD CONSTRAINT "properties_coordinates_pair" CHECK ((latitude IS NULL) = (longitude IS NULL));

ALTER TABLE inmobiliaria.properties
  ADD CONSTRAINT "properties_currency_check" CHECK (currency::text = ANY (ARRAY['ARS'::character varying, 'USD'::character varying]::text[]));

ALTER TABLE inmobiliaria.properties
  ADD CONSTRAINT "properties_description_check" CHECK (btrim(description) <> ''::text);

ALTER TABLE inmobiliaria.properties
  ADD CONSTRAINT "properties_expenses_check" CHECK (expenses >= 0::numeric);

ALTER TABLE inmobiliaria.properties
  ADD CONSTRAINT "properties_garage_check" CHECK (garage >= 0);

ALTER TABLE inmobiliaria.properties
  ADD CONSTRAINT "properties_latitude_check" CHECK (latitude >= '-90'::integer::numeric AND latitude <= 90::numeric);

ALTER TABLE inmobiliaria.properties
  ADD CONSTRAINT "properties_longitude_check" CHECK (longitude >= '-180'::integer::numeric AND longitude <= 180::numeric);

ALTER TABLE inmobiliaria.properties
  ADD CONSTRAINT "properties_operation_type_check" CHECK (operation_type = ANY (ARRAY['sale'::text, 'rent'::text, 'temporary_rent'::text]));

ALTER TABLE inmobiliaria.properties
  ADD CONSTRAINT "properties_price_check" CHECK (price > 0::numeric);

ALTER TABLE inmobiliaria.properties
  ADD CONSTRAINT "properties_property_condition_check" CHECK (property_condition = ANY (ARRAY['new'::text, 'excellent'::text, 'good'::text, 'to-renovate'::text]));

ALTER TABLE inmobiliaria.properties
  ADD CONSTRAINT "properties_property_type_check" CHECK (property_type = ANY (ARRAY['house'::text, 'apartment'::text, 'land'::text, 'commercial'::text]));

ALTER TABLE inmobiliaria.properties
  ADD CONSTRAINT "properties_publication_status_check" CHECK (publication_status = ANY (ARRAY['active'::text, 'paused'::text, 'deleted'::text]));

ALTER TABLE inmobiliaria.properties
  ADD CONSTRAINT "properties_rooms_check" CHECK (rooms > 0);

ALTER TABLE inmobiliaria.properties
  ADD CONSTRAINT "properties_street_check" CHECK (street IS NULL OR btrim(street) <> ''::text);

ALTER TABLE inmobiliaria.properties
  ADD CONSTRAINT "properties_street_number_check" CHECK (street_number IS NULL OR btrim(street_number::text) <> ''::text);

ALTER TABLE inmobiliaria.properties
  ADD CONSTRAINT "properties_taxes_check" CHECK (taxes >= 0::numeric);

ALTER TABLE inmobiliaria.properties
  ADD CONSTRAINT "properties_title_check" CHECK (btrim(title) <> ''::text);

ALTER TABLE inmobiliaria.properties
  ADD CONSTRAINT "properties_total_area_check" CHECK (total_area > 0::numeric);

ALTER TABLE inmobiliaria.property_change_history
  ADD CONSTRAINT "property_change_history_action_check" CHECK (action = ANY (ARRAY['created'::text, 'updated'::text, 'paused'::text, 'reactivated'::text, 'deleted'::text]));

ALTER TABLE inmobiliaria.property_images
  ADD CONSTRAINT "property_images_position_check" CHECK ("position" >= 0 AND "position" <= 4);

ALTER TABLE inmobiliaria.property_images
  ADD CONSTRAINT "property_images_url_check" CHECK (btrim(url) <> ''::text);

ALTER TABLE inmobiliaria.provinces
  ADD CONSTRAINT "provinces_country_check" CHECK (btrim(country) <> ''::text);

ALTER TABLE inmobiliaria.provinces
  ADD CONSTRAINT "provinces_name_check" CHECK (btrim(name) <> ''::text);

ALTER TABLE inmobiliaria.publisher_applications
  ADD CONSTRAINT "publisher_application_agency_name" CHECK (publisher_type = 'individual'::text AND agency_name IS NULL OR publisher_type = 'agency'::text AND agency_name IS NOT NULL AND btrim(agency_name) <> ''::text);

ALTER TABLE inmobiliaria.publisher_applications
  ADD CONSTRAINT "publisher_application_resolution" CHECK (status = 'pending'::text AND reviewed_at IS NULL AND reviewed_by IS NULL AND rejection_reason IS NULL OR status = 'approved'::text AND reviewed_at IS NOT NULL AND reviewed_by IS NOT NULL AND rejection_reason IS NULL OR status = 'rejected'::text AND reviewed_at IS NOT NULL AND reviewed_by IS NOT NULL);

ALTER TABLE inmobiliaria.publisher_applications
  ADD CONSTRAINT "publisher_application_reviewer" CHECK (reviewed_by IS NULL OR reviewed_by <> user_id);

ALTER TABLE inmobiliaria.publisher_applications
  ADD CONSTRAINT "publisher_applications_phone_check" CHECK (btrim(phone) <> ''::text);

ALTER TABLE inmobiliaria.publisher_applications
  ADD CONSTRAINT "publisher_applications_publisher_type_check" CHECK (publisher_type = ANY (ARRAY['individual'::text, 'agency'::text]));

ALTER TABLE inmobiliaria.publisher_applications
  ADD CONSTRAINT "publisher_applications_rejection_reason_check" CHECK (rejection_reason IS NULL OR btrim(rejection_reason) <> ''::text);

ALTER TABLE inmobiliaria.publisher_applications
  ADD CONSTRAINT "publisher_applications_status_check" CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text]));

ALTER TABLE inmobiliaria.publisher_applications
  ADD CONSTRAINT "publisher_applications_tax_id_check" CHECK (tax_id::text ~ '^[0-9]{11}$'::text);

ALTER TABLE inmobiliaria.publisher_profiles
  ADD CONSTRAINT "publisher_profile_agency_name" CHECK (publisher_type = 'individual'::text AND agency_name IS NULL OR publisher_type = 'agency'::text AND agency_name IS NOT NULL AND btrim(agency_name) <> ''::text);

ALTER TABLE inmobiliaria.publisher_profiles
  ADD CONSTRAINT "publisher_profiles_publisher_type_check" CHECK (publisher_type = ANY (ARRAY['individual'::text, 'agency'::text]));

ALTER TABLE inmobiliaria.publisher_profiles
  ADD CONSTRAINT "publisher_profiles_tax_id_check" CHECK (tax_id::text ~ '^[0-9]{11}$'::text);

ALTER TABLE inmobiliaria.search_alerts
  ADD CONSTRAINT "search_alert_has_filter" CHECK (operation_type IS NOT NULL OR property_type IS NOT NULL OR province_id IS NOT NULL OR city_id IS NOT NULL OR currency IS NOT NULL OR min_price IS NOT NULL OR max_price IS NOT NULL);

ALTER TABLE inmobiliaria.search_alerts
  ADD CONSTRAINT "search_alert_location" CHECK (province_id IS NULL OR city_id IS NULL);

ALTER TABLE inmobiliaria.search_alerts
  ADD CONSTRAINT "search_alert_price_currency" CHECK (min_price IS NULL AND max_price IS NULL OR currency IS NOT NULL);

ALTER TABLE inmobiliaria.search_alerts
  ADD CONSTRAINT "search_alert_price_range" CHECK (min_price IS NULL OR max_price IS NULL OR min_price <= max_price);

ALTER TABLE inmobiliaria.search_alerts
  ADD CONSTRAINT "search_alerts_currency_check" CHECK (currency IS NULL OR (currency::text = ANY (ARRAY['ARS'::character varying, 'USD'::character varying]::text[])));

ALTER TABLE inmobiliaria.search_alerts
  ADD CONSTRAINT "search_alerts_max_price_check" CHECK (max_price IS NULL OR max_price >= 0::numeric);

ALTER TABLE inmobiliaria.search_alerts
  ADD CONSTRAINT "search_alerts_min_price_check" CHECK (min_price IS NULL OR min_price >= 0::numeric);

ALTER TABLE inmobiliaria.search_alerts
  ADD CONSTRAINT "search_alerts_name_check" CHECK (name IS NULL OR btrim(name) <> ''::text);

ALTER TABLE inmobiliaria.search_alerts
  ADD CONSTRAINT "search_alerts_operation_type_check" CHECK (operation_type IS NULL OR (operation_type = ANY (ARRAY['sale'::text, 'rent'::text, 'temporary_rent'::text])));

ALTER TABLE inmobiliaria.search_alerts
  ADD CONSTRAINT "search_alerts_property_type_check" CHECK (property_type IS NULL OR (property_type = ANY (ARRAY['house'::text, 'apartment'::text, 'land'::text, 'commercial'::text])));

ALTER TABLE inmobiliaria.services
  ADD CONSTRAINT "services_code_check" CHECK (btrim(code) <> ''::text);

ALTER TABLE inmobiliaria.services
  ADD CONSTRAINT "services_name_check" CHECK (btrim(name) <> ''::text);

ALTER TABLE inmobiliaria.users
  ADD CONSTRAINT "users_account_status_check" CHECK (account_status = ANY (ARRAY['active'::text, 'disabled'::text]));

ALTER TABLE inmobiliaria.users
  ADD CONSTRAINT "users_email_check" CHECK (email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'::text);

ALTER TABLE inmobiliaria.users
  ADD CONSTRAINT "users_first_name_check" CHECK (char_length(btrim(first_name)) >= 2);

ALTER TABLE inmobiliaria.users
  ADD CONSTRAINT "users_last_name_check" CHECK (char_length(btrim(last_name)) >= 2);

ALTER TABLE inmobiliaria.users
  ADD CONSTRAINT "users_password_hash_check" CHECK (btrim(password_hash) <> ''::text);

ALTER TABLE inmobiliaria.users
  ADD CONSTRAINT "users_phone_check" CHECK (phone IS NULL OR btrim(phone) <> ''::text);

ALTER TABLE inmobiliaria.users
  ADD CONSTRAINT "users_publisher_phone" CHECK (role <> 'publisher'::text OR phone IS NOT NULL);

ALTER TABLE inmobiliaria.users
  ADD CONSTRAINT "users_role_check" CHECK (role = ANY (ARRAY['interested'::text, 'publisher'::text, 'admin'::text]));

ALTER TABLE inmobiliaria.users
  ADD CONSTRAINT "users_auth_version_check" CHECK (auth_version >= 0);

ALTER TABLE inmobiliaria.auth_tokens
  ADD CONSTRAINT "auth_tokens_purpose_check" CHECK (purpose = ANY (ARRAY['email_verification'::text, 'password_reset'::text]));

ALTER TABLE inmobiliaria.auth_tokens
  ADD CONSTRAINT "auth_tokens_expiry_check" CHECK (expires_at > created_at);

ALTER TABLE inmobiliaria.auth_tokens
  ADD CONSTRAINT "auth_tokens_user_id_fkey" FOREIGN KEY (user_id) REFERENCES inmobiliaria.users(id) ON DELETE CASCADE;

ALTER TABLE inmobiliaria.cities
  ADD CONSTRAINT "cities_province_id_fkey" FOREIGN KEY (province_id) REFERENCES inmobiliaria.provinces(id) ON DELETE RESTRICT;

ALTER TABLE inmobiliaria.consultations
  ADD CONSTRAINT "consultations_property_id_fkey" FOREIGN KEY (property_id) REFERENCES inmobiliaria.properties(id) ON DELETE RESTRICT;

ALTER TABLE inmobiliaria.consultations
  ADD CONSTRAINT "consultations_user_id_fkey" FOREIGN KEY (user_id) REFERENCES inmobiliaria.users(id) ON DELETE SET NULL;

ALTER TABLE inmobiliaria.favorites
  ADD CONSTRAINT "favorites_property_id_fkey" FOREIGN KEY (property_id) REFERENCES inmobiliaria.properties(id) ON DELETE CASCADE;

ALTER TABLE inmobiliaria.favorites
  ADD CONSTRAINT "favorites_user_id_fkey" FOREIGN KEY (user_id) REFERENCES inmobiliaria.users(id) ON DELETE CASCADE;

ALTER TABLE inmobiliaria.notifications
  ADD CONSTRAINT "notifications_consultation_id_fkey" FOREIGN KEY (consultation_id) REFERENCES inmobiliaria.consultations(id) ON DELETE SET NULL;

ALTER TABLE inmobiliaria.notifications
  ADD CONSTRAINT "notifications_property_id_fkey" FOREIGN KEY (property_id) REFERENCES inmobiliaria.properties(id) ON DELETE SET NULL;

ALTER TABLE inmobiliaria.notifications
  ADD CONSTRAINT "notifications_publisher_application_id_fkey" FOREIGN KEY (publisher_application_id) REFERENCES inmobiliaria.publisher_applications(id) ON DELETE RESTRICT;

ALTER TABLE inmobiliaria.notifications
  ADD CONSTRAINT "notifications_search_alert_id_fkey" FOREIGN KEY (search_alert_id) REFERENCES inmobiliaria.search_alerts(id) ON DELETE CASCADE;

ALTER TABLE inmobiliaria.notifications
  ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY (user_id) REFERENCES inmobiliaria.users(id) ON DELETE CASCADE;

ALTER TABLE inmobiliaria.properties
  ADD CONSTRAINT "properties_city_id_fkey" FOREIGN KEY (city_id) REFERENCES inmobiliaria.cities(id) ON DELETE RESTRICT;

ALTER TABLE inmobiliaria.properties
  ADD CONSTRAINT "properties_publisher_id_fkey" FOREIGN KEY (publisher_id) REFERENCES inmobiliaria.publisher_profiles(user_id) ON DELETE RESTRICT;

ALTER TABLE inmobiliaria.property_amenities
  ADD CONSTRAINT "property_amenities_amenity_id_fkey" FOREIGN KEY (amenity_id) REFERENCES inmobiliaria.amenities(id) ON DELETE RESTRICT;

ALTER TABLE inmobiliaria.property_amenities
  ADD CONSTRAINT "property_amenities_property_id_fkey" FOREIGN KEY (property_id) REFERENCES inmobiliaria.properties(id) ON DELETE CASCADE;

ALTER TABLE inmobiliaria.property_change_history
  ADD CONSTRAINT "property_change_history_changed_by_fkey" FOREIGN KEY (changed_by) REFERENCES inmobiliaria.users(id) ON DELETE SET NULL;

ALTER TABLE inmobiliaria.property_change_history
  ADD CONSTRAINT "property_change_history_property_id_fkey" FOREIGN KEY (property_id) REFERENCES inmobiliaria.properties(id) ON DELETE RESTRICT;

ALTER TABLE inmobiliaria.property_images
  ADD CONSTRAINT "property_images_property_id_fkey" FOREIGN KEY (property_id) REFERENCES inmobiliaria.properties(id) ON DELETE CASCADE;

ALTER TABLE inmobiliaria.property_services
  ADD CONSTRAINT "property_services_property_id_fkey" FOREIGN KEY (property_id) REFERENCES inmobiliaria.properties(id) ON DELETE CASCADE;

ALTER TABLE inmobiliaria.property_services
  ADD CONSTRAINT "property_services_service_id_fkey" FOREIGN KEY (service_id) REFERENCES inmobiliaria.services(id) ON DELETE RESTRICT;

ALTER TABLE inmobiliaria.property_views
  ADD CONSTRAINT "property_views_property_id_fkey" FOREIGN KEY (property_id) REFERENCES inmobiliaria.properties(id) ON DELETE RESTRICT;

ALTER TABLE inmobiliaria.publisher_applications
  ADD CONSTRAINT "publisher_applications_reviewed_by_fkey" FOREIGN KEY (reviewed_by) REFERENCES inmobiliaria.users(id) ON DELETE RESTRICT;

ALTER TABLE inmobiliaria.publisher_applications
  ADD CONSTRAINT "publisher_applications_user_id_fkey" FOREIGN KEY (user_id) REFERENCES inmobiliaria.users(id) ON DELETE RESTRICT;

ALTER TABLE inmobiliaria.publisher_profiles
  ADD CONSTRAINT "publisher_profiles_user_id_fkey" FOREIGN KEY (user_id) REFERENCES inmobiliaria.users(id) ON DELETE RESTRICT;

ALTER TABLE inmobiliaria.search_alerts
  ADD CONSTRAINT "search_alerts_city_id_fkey" FOREIGN KEY (city_id) REFERENCES inmobiliaria.cities(id) ON DELETE RESTRICT;

ALTER TABLE inmobiliaria.search_alerts
  ADD CONSTRAINT "search_alerts_province_id_fkey" FOREIGN KEY (province_id) REFERENCES inmobiliaria.provinces(id) ON DELETE RESTRICT;

ALTER TABLE inmobiliaria.search_alerts
  ADD CONSTRAINT "search_alerts_user_id_fkey" FOREIGN KEY (user_id) REFERENCES inmobiliaria.users(id) ON DELETE CASCADE;
