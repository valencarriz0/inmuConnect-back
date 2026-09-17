# Imágenes de propiedades con Supabase Storage

## Objetivo y arquitectura

El módulo convierte archivos seleccionados por un publicador en URLs persistentes que luego usa el CRUD de propiedades:

```text
Frontend → API Express autenticada → Supabase Storage
                            ↓
                    URL pública persistente
                            ↓
                    CRUD de propiedades
```

La secret key se configura únicamente en el backend. El frontend envía archivos al API y nunca recibe credenciales de Supabase. Sequelize y PostgreSQL continúan administrando los datos de la aplicación; el cliente de Supabase se usa sólo para Storage.

## Configuración

Variables requeridas:

```dotenv
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_SECRET_KEY=secret-key-del-backend
SUPABASE_STORAGE_BUCKET=property-images
```

`SUPABASE_SERVICE_ROLE_KEY` puede usarse como alternativa legacy cuando no existe `SUPABASE_SECRET_KEY`. Las dos credenciales son privadas y no deben incorporarse al frontend, logs ni repositorio.

**El bucket debe configurarse manualmente en Supabase.** La aplicación no crea buckets, no ejecuta SQL de Storage y no modifica RLS ni policies.

## Bucket y objetos

El bucket configurado es `property-images`. Debe ser público para que el catálogo sin autenticación pueda mostrar las imágenes. La escritura y la eliminación se realizan exclusivamente desde el backend con la credencial elevada.

Cada objeto usa esta ruta:

```text
properties/{publisherId}/{uuid}.{jpg|png|webp}
```

El UUID se genera con `crypto.randomUUID()`. La extensión proviene del contenido detectado y el nombre original no forma parte de la ruta.

## Subida

`POST /api/publisher/property-images` requiere JWT y rol `publisher`. Recibe `multipart/form-data` con el campo `images`.

- Acepta de 1 a 5 archivos por request.
- Cada archivo puede pesar hasta 5 MB.
- Admite JPEG, PNG y WebP.
- Compara el MIME declarado con la firma real del archivo mediante `file-type`.
- Mantiene los buffers en memoria; no escribe archivos temporales.
- Usa `upsert: false` y conserva el orden del request en la respuesta.
- Tiene un límite propio de 30 requests cada 15 minutos por IP en producción.

Ejemplo manual, sin incluir credenciales de Supabase:

```bash
curl -X POST http://localhost:3000/api/publisher/property-images \
  -H "Authorization: Bearer $TOKEN" \
  -F "images=@./frente.jpg" \
  -F "images=@./patio.webp"
```

Respuesta `201`:

```json
{
  "images": [
    {
      "url": "https://tu-proyecto.supabase.co/storage/v1/object/public/property-images/properties/USER_ID/UUID.jpg",
      "path": "properties/USER_ID/UUID.jpg"
    }
  ]
}
```

Todos los archivos se validan antes del primer upload. Si una subida falla luego de haber guardado objetos de la misma tanda, el backend intenta eliminarlos y responde `503` con un mensaje seguro. Supabase Storage y PostgreSQL no comparten una transacción.

## Limpieza de uploads no utilizados

`DELETE /api/publisher/property-images` requiere JWT y rol `publisher`. Recibe entre 1 y 5 paths:

```json
{
  "paths": [
    "properties/USER_ID/UUID.jpg"
  ]
}
```

Sólo acepta objetos bajo `properties/{req.user.id}/` con el nombre generado por el backend. Rechaza URLs, traversal, buckets distintos y rutas de otro publicador. Una eliminación correcta responde `204`.

```bash
curl -X DELETE http://localhost:3000/api/publisher/property-images \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"paths":["properties/USER_ID/UUID.jpg"]}'
```

Este endpoint permite limpiar una subida si el usuario cancela el formulario o si la creación de la propiedad falla.

## Integración con el CRUD de propiedades

Una publicación completa conserva la regla de 2 a 5 imágenes. Después del upload, el frontend envía las URLs obtenidas en `images` al `POST` o `PATCH` de propiedades.

El CRUD verifica que cada URL:

1. use el origen de `SUPABASE_URL`;
2. corresponda al bucket configurado;
3. tenga un path propio del publicador autenticado y el formato generado por el backend.

Al reemplazar `images` mediante `PATCH`, primero se confirma la transacción PostgreSQL. Después se intenta eliminar de Storage cada objeto anterior que dejó de estar asociado. Si esta limpieza falla, la edición permanece confirmada y se registra un mensaje técnico sin datos sensibles. En ese caso puede quedar un objeto huérfano que deberá limpiarse de forma operativa.

El `DELETE` de una propiedad continúa siendo lógico. No elimina sus objetos de Storage porque la publicación y sus relaciones se conservan internamente.

## Errores

- `400`: cantidad, tamaño, firma, MIME, URL o path inválido.
- `401`: falta autenticación.
- `403`: el usuario no tiene rol `publisher`.
- `503`: Storage no está disponible. La respuesta no incluye errores crudos, claves ni headers de Supabase.

## Pruebas y límites

Las pruebas usan dobles del adaptador de Storage; no se conectan a Supabase. Cubren autenticación, multipart, formatos, tamaño, UUID, orden, rollback, limpieza, ownership, reemplazo posterior al commit y conservación durante el soft delete.

Los buffers viven en memoria durante el request. Una tanda máxima puede ocupar aproximadamente 25 MB más el costo del procesamiento HTTP. No hay una transacción distribuida entre Storage y PostgreSQL ni una cola automática para objetos huérfanos.

## Pasos manuales pendientes en Supabase

1. Abrir Storage en el proyecto correcto.
2. Crear el bucket `property-images`.
3. Marcar el bucket como público para lectura.
4. Configurar un máximo de 5 MB por archivo en el bucket.
5. Restringir los MIME permitidos a `image/jpeg`, `image/png` e `image/webp`, `image/jpg`.
6. Mantener la escritura y eliminación fuera del navegador; no compartir la secret key.
7. Configurar `SUPABASE_URL`, `SUPABASE_SECRET_KEY` y `SUPABASE_STORAGE_BUCKET` en el entorno del backend.
8. Si se usa una clave legacy, configurar `SUPABASE_SERVICE_ROLE_KEY` en lugar de `SUPABASE_SECRET_KEY`.


