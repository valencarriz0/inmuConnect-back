-- Referencia obtenida por SELECT del catálogo de Supabase.
-- Sólo para una base vacía revisada; NO ejecutar sobre la base activa.

CREATE INDEX consultations_property_date ON inmobiliaria.consultations USING btree (property_id, created_at DESC);

CREATE INDEX consultations_user_date ON inmobiliaria.consultations USING btree (user_id, created_at DESC) WHERE (user_id IS NOT NULL);

CREATE INDEX favorites_property ON inmobiliaria.favorites USING btree (property_id);

CREATE UNIQUE INDEX notifications_alert_property_unique ON inmobiliaria.notifications USING btree (search_alert_id, property_id) WHERE (type = 'new_property_match'::text);

CREATE INDEX notifications_application ON inmobiliaria.notifications USING btree (publisher_application_id) WHERE (publisher_application_id IS NOT NULL);

CREATE INDEX notifications_consultation ON inmobiliaria.notifications USING btree (consultation_id) WHERE (consultation_id IS NOT NULL);

CREATE INDEX notifications_search_alert ON inmobiliaria.notifications USING btree (search_alert_id) WHERE (search_alert_id IS NOT NULL);

CREATE INDEX notifications_unread_user ON inmobiliaria.notifications USING btree (user_id, created_at DESC) WHERE (read_at IS NULL);

CREATE INDEX notifications_user_date ON inmobiliaria.notifications USING btree (user_id, created_at DESC);

CREATE INDEX properties_active_operation ON inmobiliaria.properties USING btree (operation_type) WHERE (publication_status = 'active'::text);

CREATE INDEX properties_active_price ON inmobiliaria.properties USING btree (currency, price) WHERE (publication_status = 'active'::text);

CREATE INDEX properties_active_type ON inmobiliaria.properties USING btree (property_type) WHERE (publication_status = 'active'::text);

CREATE INDEX properties_city_status ON inmobiliaria.properties USING btree (city_id, publication_status);

CREATE INDEX properties_publisher_status ON inmobiliaria.properties USING btree (publisher_id, publication_status);

CREATE INDEX property_amenities_amenity ON inmobiliaria.property_amenities USING btree (amenity_id);

CREATE INDEX property_change_history_property_date ON inmobiliaria.property_change_history USING btree (property_id, created_at DESC);

CREATE INDEX property_services_service ON inmobiliaria.property_services USING btree (service_id);

CREATE INDEX property_views_property_date ON inmobiliaria.property_views USING btree (property_id, created_at DESC);

CREATE INDEX property_views_user_date ON inmobiliaria.property_views USING btree (user_id, created_at DESC) WHERE (user_id IS NOT NULL);

CREATE INDEX publisher_applications_status_date ON inmobiliaria.publisher_applications USING btree (status, created_at DESC);

CREATE UNIQUE INDEX publisher_applications_tax_id_open_unique ON inmobiliaria.publisher_applications USING btree (tax_id) WHERE (status = ANY (ARRAY['pending'::text, 'approved'::text]));

CREATE INDEX publisher_applications_user_date ON inmobiliaria.publisher_applications USING btree (user_id, created_at DESC);

CREATE UNIQUE INDEX publisher_applications_user_open_unique ON inmobiliaria.publisher_applications USING btree (user_id) WHERE (status = ANY (ARRAY['pending'::text, 'approved'::text]));

CREATE INDEX search_alerts_active_city ON inmobiliaria.search_alerts USING btree (city_id) WHERE ((is_active = true) AND (city_id IS NOT NULL));

CREATE INDEX search_alerts_active_province ON inmobiliaria.search_alerts USING btree (province_id) WHERE ((is_active = true) AND (province_id IS NOT NULL));

CREATE INDEX search_alerts_user_active ON inmobiliaria.search_alerts USING btree (user_id, is_active);

CREATE UNIQUE INDEX users_email_unique ON inmobiliaria.users USING btree (lower(email));

CREATE UNIQUE INDEX auth_tokens_token_hash_unique ON inmobiliaria.auth_tokens USING btree (token_hash);

CREATE INDEX auth_tokens_user_purpose_active ON inmobiliaria.auth_tokens USING btree (user_id, purpose, expires_at) WHERE (used_at IS NULL);
