# lg-pruebas-kafka

> Audit Logger Service generado por **Jarvis Platform** — 2/4/2026

Consumidor Kafka que persiste eventos de auditoría en SQL Server.
Expone endpoints HTTP de consulta protegidos con API key.

## Modelo de datos

```
lg_user          — copia denormalizada del usuario (upsert en cada LOGIN_SUCCESS)
lg_auth_session  — sesiones de autenticación
lg_auth_token    — tokens emitidos por sesión
lg_audit_event   — registro central de todos los eventos ← tabla principal
lg_audit_trace   — trazas distribuidas entre microservicios
```

## Routing de eventos Kafka

| event_type | lg_audit_event | lg_user | lg_auth_session | lg_auth_token | lg_audit_trace |
|------------|:-:|:-:|:-:|:-:|:-:|
| LOGIN_SUCCESS | ✓ | upsert | crear | — | — |
| LOGIN_FAILED  | ✓ | — | — | — | — |
| LOGOUT        | ✓ | — | status=revoked | — | — |
| TOKEN_REFRESH | ✓ | — | — | crear | — |
| GATEWAY_REQUEST | ✓ | — | — | — | upsert |

## Endpoints HTTP

Todos los endpoints (excepto `/audit/health`) requieren el header `x-api-key`.

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/audit/events` | Consultar eventos con filtros |
| GET | `/audit/trace/:traceId` | Traza completa — todos los eventos de un request |
| GET | `/audit/session/:sessionId` | Sesión + eventos + tokens |
| GET | `/audit/health` | Health check (sin autenticación) |

### Autenticación — API Key

Los endpoints de consulta están protegidos con una clave estática configurada en `.env`:

```bash
# .env del lg-pruebas-kafka
AUDIT_API_KEY=mi-clave-secreta-interna

# Uso en cada request
x-api-key: mi-clave-secreta-interna
```

- Si `AUDIT_API_KEY` está **vacío**: el guard es permisivo (útil en desarrollo)
- Si `AUDIT_API_KEY` tiene valor: cualquier request sin el header o con clave incorrecta recibe `401 Unauthorized`
- En producción **siempre** configurar un valor largo y aleatorio

### Filtros disponibles en GET /audit/events

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `userId` | string | Filtrar por UUID de usuario |
| `username` | string | Filtrar por código de usuario |
| `eventType` | string | `LOGIN_SUCCESS`, `LOGIN_FAILED`, `LOGOUT`, `TOKEN_REFRESH`, `GATEWAY_REQUEST` |
| `outcome` | string | `SUCCESS`, `FAILED`, `ERROR` |
| `sourceSystem` | string | Sistema origen del evento |
| `traceId` | string | UUID de traza |
| `from` | ISO 8601 | Fecha/hora desde |
| `to` | ISO 8601 | Fecha/hora hasta |
| `limit` | number | Máximo de resultados (default 200) |

### Ejemplos de consulta

```bash
# Variable de entorno con la key (o sustituir directamente)
KEY=mi-clave-secreta-interna

# Todos los logins fallidos
curl -H "x-api-key: $KEY" "http://localhost:10400/audit/events?eventType=LOGIN_FAILED"

# Logins fallidos en un rango de fechas
curl -H "x-api-key: $KEY" "http://localhost:10400/audit/events?eventType=LOGIN_FAILED&from=2026-01-01T00:00:00Z&to=2026-01-31T23:59:59Z"

# Seguir un request a través de todos los microservicios
curl -H "x-api-key: $KEY" "http://localhost:10400/audit/trace/abc-123-uuid"

# Ver sesión completa de un usuario
curl -H "x-api-key: $KEY" "http://localhost:10400/audit/session/session-uuid-aqui"

# Eventos de un usuario específico (últimos 50)
curl -H "x-api-key: $KEY" "http://localhost:10400/audit/events?userId=user-uuid&limit=50"

# Health check (sin key)
curl "http://localhost:10400/audit/health"
```

## Variables de entorno

| Variable | Requerida | Default | Descripción |
|----------|:---------:|---------|-------------|
| `PORT` | — | `10400` | Puerto HTTP |
| `NODE_ENV` | — | `development` | Entorno (`development` / `production`) |
| `AUDIT_API_KEY` | Prod ✓ | — | API key para proteger los endpoints HTTP de consulta. Vacío = permisivo |
| `KAFKA_BROKER` | ✓ | — | Broker(s) Kafka (coma-separados) — este servicio actúa como **consumer** |
| `KAFKA_TOPIC` | — | `platform.logs` | Topic del que consume eventos |
| `DB_HOST` | ✓ | — | Host del SQL Server |
| `DB_PORT` | — | `1433` | Puerto SQL Server |
| `DB_USER` | ✓ | — | Usuario SQL Server |
| `DB_PASS` | ✓ | — | Contraseña SQL Server |
| `DB_NAME` | — | `audit_db` | Nombre de la base de datos |
| `DB_INSTANCE` | — | — | Instancia nombrada de SQL Server (vacío si se usa puerto directo) |

## Notas

- Las tablas se crean automáticamente en el primer arranque en `NODE_ENV=development`
- En producción `synchronize` está desactivado — usar migraciones TypeORM
- El campo `payload_encrypted` actualmente almacena JSON plano. Para cifrado con AES-256-GCM ver pendiente S5 del code review

## Instalación

```bash
npm install
cp .env.example .env
# Completar DB_HOST, DB_USER, DB_PASS y KAFKA_BROKER
# En producción: establecer AUDIT_API_KEY con un valor seguro
npm run start:dev
```
