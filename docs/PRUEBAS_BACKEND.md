# Pruebas unitarias del backend

## Objetivo

La suite verifica reglas de negocio, servicios, validaciones, middlewares y contratos HTTP del backend sin depender del frontend ni de servicios reales.

## Herramienta y ejecución

Se usa `node:test` con `node:assert/strict`.

```sh
npm test
```

## Qué se prueba

La suite cubre autenticación y seguridad de cuenta, usuarios, solicitudes de publicador, propiedades, imágenes, catálogos públicos, geocodificación, consultas, favoritos, visualizaciones, métricas, notificaciones, alertas de búsqueda, administración y scripts SQL.

Los services se prueban con modelos mockeados cuando la regla no necesita HTTP. Los tests de rutas verifican autenticación, roles, validaciones y el contrato de respuesta en los endpoints importantes.

## Aislamiento

Los tests no se conectan a Supabase, SMTP, Storage ni Nominatim. Los modelos Sequelize, el mailer, Storage y `fetch` se reemplazan por mocks según el caso.

Ejemplos reales de la suite:

- una consulta anónima crea la consulta y la notificación en la misma transacción;
- una propiedad ajena no puede editarse desde el panel del publicador;
- un upload que falla limpia los objetos ya subidos;
- una alerta activa que coincide crea una notificación y solicita el correo;
- una coincidencia ya notificada no envía un correo duplicado;
- un error SMTP de alerta no revierte la creación de la propiedad;
- un JWT anterior deja de ser válido después de cambiar la contraseña.

## Resultado actual

La suite backend cuenta con 314 pruebas automatizadas.

Resultado de la última ejecución:

- 314 pruebas aprobadas.
- 0 pruebas fallidas.

Además, se ejecutó:

```bash
npm run db:check
```

Este comando no forma parte de la suite. Sólo verifica lecturas de los catálogos en la base configurada y requiere credenciales válidas de Supabase.

