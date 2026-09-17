# InmuConnect - Backend

API REST de InmuConnect. Está desarrollada con Node.js, Express, Sequelize y PostgreSQL en Supabase. Gestiona cuentas, propiedades, catálogos, consultas, alertas, notificaciones, métricas y administración.

## Requisitos e instalación

- Node.js 22 o superior.
- Una base PostgreSQL configurada en Supabase.
- Un bucket de Supabase Storage para las imágenes.

```bash
npm ci
cp .env.example .env
```

Completá `.env` con los datos de tu entorno. No subas ese archivo ni credenciales al repositorio.

## Variables de entorno

| Grupo | Variables |
| --- | --- |
| Servidor | `NODE_ENV`, `PORT`, `CORS_ORIGIN`, `APP_URL` |
| Base de datos | `DB_CONNECTION_STRING`, `DB_SSL` |
| Sesiones | `JWT_SECRET`, `JWT_EXPIRES_IN` |
| Correo | `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM` |
| Seguridad de cuenta | `EMAIL_VERIFICATION_TTL_MINUTES`, `PASSWORD_RESET_TTL_MINUTES` |
| Geocodificación | `NOMINATIM_BASE_URL`, `NOMINATIM_USER_AGENT`, `NOMINATIM_TIMEOUT_MS` |
| Storage | `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `SUPABASE_STORAGE_BUCKET` |

`SUPABASE_SERVICE_ROLE_KEY` puede usarse como alternativa para la clave de Storage. Es una credencial exclusiva del backend y nunca debe llegar al frontend.

La validación de las variables se encuentra en `src/config/env.js`.

## Ejecución

```bash
npm run dev
```

Para iniciar sin recarga automática:

```bash
npm start
```

Antes de abrir el puerto, el servidor verifica la conexión con PostgreSQL. Si falta configuración o no puede conectarse, no inicia.

## Health check

```bash
curl http://localhost:3000/api/health
```

Devuelve el estado del servicio y una marca de tiempo. No consulta la base en cada llamada: la conexión se verifica al iniciar el servidor.

## Funcionalidades

- Registro, inicio de sesión, verificación de correo y recuperación de contraseña.
- Solicitudes para convertirse en publicador.
- Catálogo público, filtros, detalle y registro de visualizaciones.
- Gestión de propiedades, imágenes, ubicación e historial de cambios.
- Consultas, favoritos, alertas de búsqueda y notificaciones.
- Métricas para publicadores y administración de usuarios y publicaciones.

Las rutas se registran en `src/routes/index.js`. Los módulos agrupan validación, controlador y servicio. Los modelos Sequelize usan el schema `inmobiliaria` y no se ejecuta `sequelize.sync()`.

## Base de datos

La documentación y los scripts están en [database/](database/README.md). El archivo `database/inmobiliaria.sql` es el script original de creación y se conserva como referencia histórica. Los archivos `01` a `04` documentan y reconstruyen una base vacía; `05` y `06` son cambios históricos ya incorporados en la captura actual, por lo que no deben ejecutarse de nuevo sobre ella.

El script `07_georef_localidades.sql` amplía el catálogo con provincias y localidades oficiales de Argentina. Revisalo antes de ejecutarlo en Supabase.

## Pruebas

```bash
npm test
```

La suite usa `node:test` y dobles de las dependencias externas. No modifica Supabase, Storage, SMTP ni Nominatim.

Para comprobar que la instancia configurada permite leer los catálogos:

```bash
npm run db:check
```

Este comando sólo realiza lecturas de provincias, localidades, servicios y comodidades.

## Estructura

```text
src/
├── config/       Configuración del entorno y Sequelize
├── middlewares/  Autenticación, autorización, validación y errores
├── models/       Modelos y asociaciones
├── modules/      Lógica organizada por funcionalidad
├── routes/       Registro de las rutas de la API
├── integrations/ Adaptadores de correo y Storage
└── server.js      Inicio del servidor

database/         Scripts y documentación de la base
docs/             Guías técnicas
test/             Pruebas automatizadas
```

## Documentación complementaria

- [Base de datos](database/README.md)
- [Propiedades](docs/propiedades.md)
- [Imágenes en Storage](docs/imagenes-storage.md)
- [Interacciones y métricas](docs/interacciones-y-metricas.md)
- [Ubicación y mapas](docs/ubicacion-y-mapas.md)
- [Pruebas](docs/PRUEBAS_BACKEND.md)
