# Base de datos

La base de InmuConnect se creó originalmente con `inmobiliaria.sql`, conservado en esta
carpeta como referencia histórica. Ese script crea el schema, las 17
tablas iniciales, sus restricciones e índices, triggers de `updated_at`, la vista
`property_metrics`, los catálogos y los permisos básicos. No representa por sí solo el
estado actual de Supabase.

Los archivos `01_schema.sql` a `04_seed.sql` se generaron después a partir del catálogo
de la base existente. Sirven para documentar y reconstruir una base vacía revisada; no
fueron los archivos usados originalmente para crear la base y no deben ejecutarse sobre
la instancia activa. La captura ya refleja cambios que llegaron después del script
inicial, incluidos los datos de seguridad y la asociación de vistas con usuarios.

## Archivos

| Archivo | Uso |
| --- | --- |
| `inmobiliaria.sql` | Script original de creación, conservado sólo como referencia histórica. |
| `01_schema.sql` | Tablas, columnas, tipos, defaults y claves primarias de la estructura actual capturada. |
| `02_constraints.sql` | Claves foráneas, restricciones `UNIQUE` y `CHECK` de esa captura. |
| `03_indexes.sql` | Índices explícitos, incluidos los parciales. |
| `04_seed.sql` | Catálogos de provincias, ciudades, servicios y comodidades. |
| `05_account_security.sql` | Cambio incremental histórico: agrega verificación de correo, `auth_version` y `auth_tokens`. |
| `06_property_views_user.sql` | Cambio incremental histórico: agrega `property_views.user_id`, su FK e índices para el historial de usuarios registrados. |
| `07_georef_localidades.sql` | Carga idempotente del catálogo oficial de provincias y localidades de Argentina para la instancia activa. |

Para una base vacía, `01` a `04` se ejecutan en ese orden después de revisar que se
disponga de `gen_random_uuid()` y permisos para crear el schema. `05` y `06` se usaron
como cambios sobre la base ya creada; no deben reaplicarse como migraciones sobre una
captura que ya contiene sus columnas, tablas, FKs e índices.

El estado actual se contrasta con esos archivos, los modelos Sequelize, el código
backend y `npm run db:check`. Este último sólo comprueba lecturas de los catálogos en la
instancia configurada; no cambia datos ni reemplaza una revisión del catálogo completo.

La vista `property_metrics`, los triggers y los permisos del script original existen
como parte de la historia de la base, pero no se reproducen en `01` a `04`, que se
limitan a tablas y catálogos para la entrega. Por ese motivo esos archivos no son un
backup completo de Supabase.

`07_georef_localidades.sql` se generó con la API Georef de Datos Argentina. Puede
ejecutarse en Supabase para ampliar los catálogos sin borrar los datos existentes.
