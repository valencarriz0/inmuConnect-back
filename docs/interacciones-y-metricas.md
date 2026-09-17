# Interacciones y métricas

## Vistas e historial

### `POST /api/properties/:id/views`

Registra una apertura exitosa de una propiedad pública activa. No requiere autenticación:
sin JWT guarda una visualización anónima y con un JWT válido asocia `user_id`. Responde
`204 No Content`; las propiedades inexistentes o no públicas responden `404`.

### `GET /api/users/me/views?page=1&limit=12`

Requiere JWT de una cuenta `interested` o `publisher`. Devuelve sólo las propiedades
públicas vistas por la cuenta actual, agrupadas por propiedad y ordenadas por la última
visualización descendente. La respuesta es `{ history, pagination }`, donde cada item
incluye `property` con el serializer público y `lastViewedAt` ISO.

### `GET /api/publisher/metrics`

Requiere JWT de publicador. Devuelve `{ summary, mostViewed, properties }` con conteos
reales de `property_views` y `consultations` de sus publicaciones activas o pausadas.

## Alertas de búsqueda

Las cuentas `interested` y `publisher` gestionan sus alertas propias mediante
`GET` y `POST /api/users/me/search-alerts`, `PATCH /api/users/me/search-alerts/:id`
y `PATCH /api/users/me/search-alerts/:id/activate|deactivate`. Los criterios opcionales
usan `null` como comodín y los límites de precio requieren moneda.

Al confirmar una propiedad nueva activa, se evalúan alertas activas por operación, tipo,
provincia/localidad, moneda y rango de precio. Cada coincidencia crea una notificación
persistente y envía un correo con enlace público. Un fallo SMTP no revierte la publicación.

## Objetivo

Este bloque incorpora consultas, favoritos, visualizaciones, métricas del publicador y notificaciones internas usando las tablas existentes. No agrega tablas ni modifica el esquema PostgreSQL.

## Roles y autenticación

| Función | Sin login | interested | publisher | admin |
|---|---:|---:|---:|---:|
| Crear consulta | Sí | Sí | Sí | Sí |
| Registrar visualización | Sí | Sí | Sí | Sí |
| Historial propio de consultas | No | Sí | Sí | No |
| Favoritos | No | Sí | Sí | No |
| Consultas recibidas | No | No | Sí | No |
| Métricas | No | No | Sí | No |
| Notificaciones propias | No | Sí | Sí | Sí |

La creación de consultas usa autenticación opcional. Si no se envía `Authorization`, la consulta queda con `userId = null`. Si se envía un JWT inválido, el API responde `401`; no lo trata como una consulta anónima.

## Consultas públicas

### `POST /api/properties/:id/consultations`

Body:

```json
{
  "firstName": "Ana",
  "lastName": "Pérez",
  "email": "ana@example.com",
  "phone": "+54 9 11 1234-5678",
  "message": "Quisiera coordinar una visita."
}
```

`message` es opcional, pero no puede quedar vacío después de normalizar espacios. La propiedad debe estar activa y no puede ser de tipo `land`. Una propiedad inexistente, pausada, eliminada o fuera del catálogo público responde `404` con `Propiedad no encontrada.`

La consulta y la notificación del publicador se crean en la misma transacción. La notificación usa el tipo `new_consultation` y no incluye los datos de contacto en su mensaje.

La restricción `notifications_reference_type` exige que una notificación `new_consultation` guarde `consultation_id` y deje `property_id` en `NULL`. El endpoint de notificaciones deriva `propertyId` desde la consulta asociada para conservar un contrato útil sin modificar la base.

Respuesta `201`:

```json
{
  "consultation": {
    "id": "UUID",
    "propertyId": "UUID",
    "firstName": "Ana",
    "lastName": "Pérez",
    "email": "ana@example.com",
    "phone": "+54 9 11 1234-5678",
    "message": "Quisiera coordinar una visita.",
    "createdAt": "2026-01-02T10:00:00.000Z"
  }
}
```

## Historial de consultas

### `GET /api/users/me/consultations`

Requiere JWT y rol `interested` o `publisher`. Filtra siempre por el identificador del JWT y ordena por fecha descendente. Cada resultado contiene los datos de la consulta y un resumen de la propiedad con identificador, título, operación, precio, moneda, imágenes, ciudad y provincia.

### `GET /api/publisher/consultations`

Requiere JWT y rol `publisher`. Devuelve consultas de propiedades cuyo `publisherId` coincide con el usuario autenticado. Puede filtrarse con `?propertyId=UUID`; una propiedad ajena o inexistente produce `404` sin revelar cuál de los dos casos ocurrió.

Los datos de contacto se entregan al publicador para que el frontend genere enlaces `mailto:` o `https://wa.me/`. El backend no envía correos ni mensajes de WhatsApp.

## Favoritos

- `GET /api/users/me/favorites`
- `PUT /api/users/me/favorites/:propertyId`
- `DELETE /api/users/me/favorites/:propertyId`

Requieren JWT y rol `interested` o `publisher`. El listado devuelve propiedades públicas resumidas y no sólo identificadores.

Sólo pueden agregarse propiedades activas que no sean `land`. Un publicador no puede guardar su propia propiedad y recibe `400`. `PUT` usa la restricción única de usuario y propiedad para ser idempotente. `DELETE` filtra por `userId` y `propertyId`; responde `204` aunque la relación no exista, sin permitir inferir favoritos ajenos.

## Visualizaciones

### `POST /api/properties/:id/views`

Es público y responde `204`. Registra una fila en `property_views` sólo si la propiedad está activa y no es `land`. No guarda IP, user-agent ni usuario.

Cuando una visualización tiene un JWT válido, `property_views.user_id` guarda la cuenta que abrió el detalle. Por eso el historial se puede consultar desde `GET /api/users/me/views`. La lista de recientes del frontend usa `sessionStorage` como ayuda local y es independiente de ese historial.

## Métricas del publicador

### `GET /api/publisher/metrics`

Requiere JWT y rol `publisher`. Ejecuta una consulta SQL parametrizada que agrupa propiedades, vistas y consultas. Usa conteos distintos para evitar multiplicar resultados al combinar las dos relaciones.

Incluye:

- cantidad de propiedades activas y pausadas;
- total de visualizaciones;
- total de consultas;
- propiedad más vista;
- detalle por propiedad ordenado por vistas, consultas y título.

Las propiedades eliminadas no aparecen en el panel. La consulta filtra siempre por el `publisherId` del JWT y no realiza una consulta adicional por cada propiedad.

## Notificaciones internas

- `GET /api/notifications`
- `PATCH /api/notifications/:id/read`
- `PATCH /api/notifications/read-all`

Requieren JWT. Todas las operaciones filtran por `Notification.userId = req.user.id`.

El listado ordena por fecha descendente y devuelve `unreadCount`. Marcar una notificación es idempotente. Una notificación ajena responde como inexistente. `read-all` actualiza únicamente las notificaciones propias cuyo `readAt` todavía es `NULL`.

Campos públicos:

```text
id, type, title, message, consultationId, publisherApplicationId,
searchAlertId, propertyId, readAt, createdAt
```

## Seguridad y errores

- `userId` y `publisherId` se derivan del JWT.
- Los serializers usan listas explícitas y no exponen modelos completos.
- El ownership de consultas recibidas se verifica mediante `Property.publisherId`.
- El ownership de favoritos se verifica mediante `Favorite.userId`.
- El ownership de notificaciones se verifica mediante `Notification.userId`.
- `400`: validación o intento de guardar una propiedad propia como favorita.
- `401`: autenticación obligatoria ausente o token enviado inválido.
- `403`: rol no admitido.
- `404`: recurso público no disponible, propiedad ajena en un filtro o notificación ajena/inexistente.

## Pruebas

Las pruebas usan `node:test`, modelos simulados y transacciones simuladas. Cubren consultas anónimas y autenticadas, atomicidad de la notificación, validación, ownership, favoritos idempotentes, visualizaciones públicas, agregación de métricas, notificaciones propias y restricciones por rol. No ejecutan escrituras contra PostgreSQL ni servicios externos.

## Alcance actual

- El historial de vistas se guarda por usuario cuando la visualización tiene JWT válido.
- Las alertas de búsqueda crean notificaciones y solicitan un correo al mailer; un fallo
  de correo no revierte la publicación.
- El backend no envía correos ni mensajes de WhatsApp para consultas.
- Las propiedades eliminadas no se incluyen en las métricas visibles.
