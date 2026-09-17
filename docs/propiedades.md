# Propiedades del publicador

## Objetivo

El módulo permite que un usuario habilitado como `publisher` administre sus propiedades. Incluye creación, consulta privada, edición, cambios de estado, eliminación lógica e historial.

La autorización del administrador se aplica a la cuenta del publicador. Las propiedades nuevas quedan activas inmediatamente y no pasan por una aprobación individual.

## Endpoints

Todos los endpoints requieren JWT y rol `publisher`:

| Método | Ruta | Uso |
|---|---|---|
| `GET` | `/api/publisher/properties` | Lista propiedades propias activas y pausadas |
| `GET` | `/api/publisher/properties/:id` | Consulta el detalle privado |
| `POST` | `/api/publisher/properties` | Crea una propiedad activa |
| `PATCH` | `/api/publisher/properties/:id` | Edita campos y colecciones |
| `PATCH` | `/api/publisher/properties/:id/pause` | Pasa de activa a pausada |
| `PATCH` | `/api/publisher/properties/:id/reactivate` | Pasa de pausada a activa |
| `DELETE` | `/api/publisher/properties/:id` | Realiza eliminación lógica |
| `GET` | `/api/publisher/properties/:id/history` | Consulta el historial |

El listado acepta `status=active`, `status=paused` o `status=all`. El valor `all` continúa excluyendo propiedades eliminadas.

## Ownership

El backend obtiene `publisherId` desde `req.user.id`; nunca lo recibe en el body. Antes de crear verifica que exista un `PublisherProfile` para ese usuario.

Las búsquedas privadas para editar, cambiar estado, eliminar o consultar historial combinan el identificador de propiedad con el identificador del publicador. Una propiedad ajena y una inexistente producen el mismo `404` para no revelar su existencia.

## Creación

El body admite los campos editables de `Property`, el par de coordenadas, URLs de imágenes, códigos de servicios y códigos de comodidades. Son obligatorios:

- `title`
- `description`
- `operationType`
- `propertyType`
- `price`
- `currency`
- `cityId`
- `totalArea`
- `rooms`
- `images`

`propertyType` admite `house`, `apartment` y `commercial`. `land` continúa en el esquema para uso futuro, pero el API lo rechaza.

El backend fija `publicationStatus` en `active`. También valida que la localidad, todos los servicios y todas las comodidades existan antes de crear filas.

## Edición

`PATCH` permite enviar únicamente los campos que deben cambiar. `id`, `publisherId`, `publicationStatus`, timestamps y campos de historial están controlados por el servidor.

Si se incluyen `images`, `serviceCodes` o `amenityCodes`, cada colección reemplaza por completo la colección anterior. Los nuevos valores se validan antes de eliminar relaciones existentes. Un PATCH que no produce cambios efectivos no agrega una entrada de historial.

## Coordenadas y dirección

`latitude` y `longitude` se aceptan juntas o ambas se omiten. Sus rangos son `-90..90` y `-180..180`.

La geocodificación pertenece al endpoint `/api/locations/geocode`. El CRUD no llama a Nominatim: recibe las coordenadas que el usuario confirmó en el frontend.

Si un PATCH cambia `cityId`, `street` o `streetNumber` y no incluye un nuevo par de coordenadas, el backend guarda ambas coordenadas como `null`. Esto evita conservar una ubicación correspondiente a una dirección anterior.

## Imágenes

La propiedad debe tener entre 2 y 5 imágenes. Antes de crear o editar, el frontend sube los archivos mediante `POST /api/publisher/property-images` y envía al CRUD las URLs persistentes devueltas. El endpoint de upload admite de 1 a 5 archivos para permitir agregar una sola imagen durante una edición.

El CRUD sólo acepta URLs públicas del `SUPABASE_URL` y bucket configurados cuyo path pertenezca al publicador autenticado. No admite URLs externas, de otro publicador, `blob:`, `data:` ni `file:`. El backend asigna `position` según el índice, por lo que la primera URL es la portada.

Cuando un PATCH reemplaza la colección, los objetos anteriores removidos se intentan borrar de Storage después del commit PostgreSQL. Un error de esa limpieza no revierte la edición y puede dejar un objeto huérfano. La eliminación lógica de la propiedad conserva sus archivos. El contrato completo está en [Imágenes de propiedades con Supabase Storage](./imagenes-storage.md).

## Servicios y comodidades

`serviceCodes` y `amenityCodes` usan los códigos semánticos de los catálogos existentes. No se aceptan duplicados ni se crean registros nuevos desde este módulo. Un código desconocido produce `400`.

Las relaciones se guardan en `property_services` y `property_amenities`. En una edición sólo se reemplazan cuando la colección correspondiente aparece en el request.

## Estados y eliminación

Las transiciones disponibles son:

```text
active → paused
paused → active
active/paused → deleted
```

Pausar una propiedad ya pausada y reactivar una ya activa son operaciones idempotentes. No generan historial duplicado. Una propiedad eliminada no puede editarse, pausarse ni reactivarse.

`DELETE` cambia `publicationStatus` a `deleted`; no ejecuta un borrado físico de `Property` ni elimina sus imágenes o relaciones. La propiedad deja de aparecer en el catálogo público y en el listado normal del publicador.

## Transacciones e historial

Creación, edición y cambios de estado se ejecutan en transacciones Sequelize. Las mutaciones existentes bloquean la fila principal mientras actualizan datos, colecciones e historial.

Las acciones registradas son:

- `created`
- `updated`
- `paused`
- `reactivated`
- `deleted`

Cada entrada guarda snapshots explícitos en `previousData` y `newData`. La respuesta del historial omite `changedBy` y no carga información privada del usuario.

## Serialización

El contrato privado incluye estado, fechas, ciudad, provincia, imágenes, servicios y comodidades. Convierte a números los campos `price`, `totalArea`, `expenses`, `taxes`, `commissions`, `latitude` y `longitude`. Un valor numérico inválido se representa como `null` en lugar de `NaN`.

## Errores

- `400`: body, relación o catálogo inválido.
- `401`: falta autenticación.
- `403`: el usuario no es publicador.
- `404`: propiedad inexistente o ajena.
- `409`: perfil de publicador inconsistente o transición no permitida.
- `500`: fallo inesperado sin detalles internos.

## Pruebas

Las pruebas automatizadas usan modelos y transacciones mockeados. Cubren autorización, validación, ownership, creación atómica, rollback, reemplazo de colecciones, coordenadas, estados, soft delete, historial y serialización. No crean propiedades en Supabase ni llaman a Nominatim.

## Alcance fuera de este módulo

- Favoritos, consultas, estadísticas, visualizaciones y alertas se documentan en
  [interacciones-y-metricas.md](./interacciones-y-metricas.md).
- La moderación administrativa tiene rutas y services propios bajo `src/modules/admin`.
- La selección de archivos y la confirmación visual de coordenadas corresponden al frontend.
