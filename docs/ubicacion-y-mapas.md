# Ubicación, geocodificación y mapas

## Objetivo

InmuConnect usa catálogos propios de provincias y localidades. Para ubicar una propiedad en un mapa también necesita convertir su dirección en coordenadas. El backend incorpora esa conversión mediante Nominatim y entrega una respuesta acotada con latitud, longitud y límites geográficos.

El modelo `Property` contiene `latitude` y `longitude`. El CRUD del publicador recibe
el par de coordenadas confirmado y lo persiste junto con la dirección.

## Arquitectura

Los datos de provincias y localidades se consultan en PostgreSQL. Esa base sigue siendo la fuente de verdad para `provinceId` y `cityId`.

El flujo de geocodificación implementado es:

```text
cityId + calle + altura
        ↓
backend de InmuConnect
        ↓
City + Province en PostgreSQL
        ↓
Nominatim Search
        ↓
coordenadas normalizadas
```

El backend no sirve mapas ni tiles. Entrega coordenadas para que el frontend las use en
el mapa.

## API propia de ubicaciones

- `GET /api/locations/provinces`: lista provincias por nombre.
- `GET /api/locations/cities`: lista localidades; acepta `provinceId` como filtro.
- `GET /api/locations/search?q=...`: busca provincias y localidades para el autocomplete de InmuConnect.

La búsqueda unificada no consulta Nominatim. Así se evita usar el servicio público como autocomplete y se conservan los identificadores propios del sistema.

## API de geocodificación

### Solicitud

`POST /api/locations/geocode` requiere un JWT de un usuario con rol `publisher` o `admin`.

```json
{
  "cityId": "dcaa991f-2f83-4273-a4ea-61f0361c52fb",
  "street": "Villegas",
  "streetNumber": "350"
}
```

- `cityId` es obligatorio y debe ser un UUID válido.
- `street` es obligatorio y admite entre 2 y 150 caracteres.
- `streetNumber` es opcional, admite hasta 30 caracteres y un valor vacío se convierte en `null`.
- No se aceptan nombres de localidad o provincia, coordenadas, usuarios ni campos desconocidos.

La localidad se consulta junto con su provincia. Si no existe, la API responde `404` con `Localidad no encontrada.`.

### Respuesta

```json
{
  "matches": [
    {
      "latitude": -35.973123,
      "longitude": -62.732456,
      "displayName": "Villegas 350, Trenque Lauquen, Buenos Aires, Argentina",
      "boundingBox": {
        "south": -35.974,
        "north": -35.972,
        "west": -62.733,
        "east": -62.731
      }
    }
  ]
}
```

Las coordenadas y el `boundingBox` se convierten a números. Un `boundingBox` inválido se informa como `null`; una coincidencia con coordenadas inválidas se descarta. Cuando no hay resultados, la respuesta es `200` con `matches: []`.

Los errores de red, timeout, respuestas `429`, respuestas `5xx`, JSON inválido o formatos inesperados se convierten en un error `503` sin incluir datos internos del proveedor.

## Consulta a Nominatim

El cliente usa `GET {NOMINATIM_BASE_URL}/search` con una consulta libre formada por:

```text
altura + calle, localidad, provincia, país
```

Los nombres geográficos siempre provienen de PostgreSQL. Los parámetros enviados son `format=jsonv2`, `addressdetails=1`, `limit=5` y `countrycodes=ar`. La respuesta se solicita en español y cada request incluye el `User-Agent` configurado.

El endpoint se usa sólo cuando una persona solicita geocodificar una dirección. No se utiliza mientras escribe, para geocodificación masiva ni para tareas periódicas. Estas restricciones responden a la [política de uso del Nominatim público](https://operations.osmfoundation.org/policies/nominatim/).

## Configuración

La instalación debe definir:

```dotenv
NOMINATIM_BASE_URL=https://nominatim.openstreetmap.org
NOMINATIM_USER_AGENT=InmuConnect/1.0 (contacto: correo@ejemplo.com)
NOMINATIM_TIMEOUT_MS=5000
```

El contacto del `User-Agent` debe reemplazarse por un dato institucional válido para el despliegue. Nominatim público no utiliza API key.

## Caché y control de frecuencia

La caché reside en memoria, conserva hasta 500 direcciones durante 24 horas y elimina primero la entrada usada hace más tiempo. La clave normaliza `cityId`, calle y altura para reutilizar variantes equivalentes. Dos solicitudes idénticas concurrentes comparten la misma Promise en vuelo.

Las llamadas externas pasan por una cola global del proceso. La cola deja 1100 ms entre el inicio de dos requests y no ejecuta dos llamadas a Nominatim en paralelo. El endpoint también tiene un límite por IP de 30 solicitudes cada 15 minutos en producción.

La caché y la cola son locales a cada proceso. Se reinician al reiniciar el backend y no coordinan varias instancias desplegadas. Si el sistema se escala horizontalmente, deberá usarse un mecanismo compartido o un proveedor con límites adecuados.

## Coordenadas de propiedades

`Property.latitude` admite valores entre `-90` y `90`, y `Property.longitude` entre `-180` y `180`. La base exige que ambas tengan valor o que ambas sean `NULL`.

El serializer público devuelve las coordenadas como `number | null`. Si el par recuperado es incompleto o inválido, devuelve ambas como `null`. En esta tarea las coincidencias de Nominatim no se guardan en la propiedad.

## Integración con el frontend

El frontend usa React Leaflet y OpenStreetMap para mostrar un marcador cuando la propiedad tiene coordenadas válidas. El backend no descarga, almacena ni sirve tiles.

El flujo actual es:

```text
publicador selecciona localidad
→ ingresa calle y altura
→ solicita geocodificación
→ selecciona o confirma una coincidencia
→ el CRUD guarda `latitude` y `longitude`
→ el detalle público muestra el mapa
```

Si cambia la localidad, calle o altura y no se confirman nuevas coordenadas, el CRUD guarda ambos valores como `null` para no conservar una ubicación anterior.

## Pruebas

Las pruebas automatizadas cubren autenticación, roles, validación, resolución de `City` y `Province`, parámetros externos, timeout, errores seguros, coordenadas, caché, concurrencia y frecuencia. `fetch`, el reloj y la espera se reemplazan por implementaciones controladas; la suite no llama al Nominatim público.

Una prueba manual posterior puede realizarse con un token válido y un `cityId` existente:

```bash
curl -X POST http://localhost:3000/api/locations/geocode \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "cityId": "UUID_DE_LOCALIDAD",
    "street": "Villegas",
    "streetNumber": "350"
  }'
```

Este comando es una referencia para prueba manual y no forma parte de la suite automatizada.

## Limitaciones actuales

- No existe reverse geocoding.
- La caché y la cola se comparten sólo dentro de un proceso.
- La disponibilidad depende del servicio de Nominatim configurado.
