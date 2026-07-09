# ms-tch-audit-logger

> Audit Logger Service generado por **Jarvis Platform** — 2/4/2026

Consumidor Kafka que persiste eventos de auditoría en SQL Server.
Expone endpoints HTTP de consulta protegidos con API key.

## Modelo de datos

```
AppUser       — copia denormalizada del usuario (upsert en cada LOGIN_SUCCESS)
AuthSession   — sesiones de autenticación (FK user_id → AppUser.user_id)
AuthToken     — tokens emitidos por sesión (FK session_id → AuthSession.session_id)
AuditEvent    — registro central de todos los eventos ← tabla principal
AuditTrace    — trazas distribuidas entre microservicios
```

`AuditEvent.session_id` es `uniqueidentifier` (consistente con `AuthSession`/`AuthToken`)
pero **sin FK** hacia `AuthSession`: es la tabla de mayor volumen de escritura y de
retención regulatoria más larga — una FK síncrona acoplaría su latencia de escritura
a validación referencial, y `AuthSession` es rotativa/purgable.

## Routing de eventos Kafka

| event_type | AuditEvent | AppUser | AuthSession | AuthToken | AuditTrace |
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
# .env del ms-tch-audit-logger
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
| `AUDIT_PAYLOAD_KEY` | Prod ✓ | — | Clave AES-256-GCM de **exactamente 32 bytes UTF-8** para cifrar `payload_encrypted`. Vacío = JSON plano |
| `KAFKA_BROKER` | ✓ | — | Broker(s) Kafka (coma-separados) — este servicio actúa como **consumer** |
| `KAFKA_TOPIC` | — | `platform.logs` | Topic del que consume eventos |
| `DB_HOST` | ✓ | — | Host del SQL Server |
| `DB_PORT` | — | `1433` | Puerto SQL Server |
| `DB_USER` | ✓ | — | Usuario SQL Server |
| `DB_PASS` | ✓ | — | Contraseña SQL Server |
| `DB_NAME` | — | `HCE_AUDIT` | Nombre de la base de datos |
| `DB_INSTANCE` | — | — | Instancia nombrada de SQL Server (vacío si se usa puerto directo) |

## Notas

- Las tablas se crean automáticamente en el primer arranque en `NODE_ENV=development`
- En producción `synchronize` está desactivado — usar migraciones TypeORM
- `payload_encrypted` se cifra con **AES-256-GCM** cuando `AUDIT_PAYLOAD_KEY` está configurado. El formato antes de persistir es `base64(iv).base64(authTag).base64(ciphertext)`, almacenado como `VARBINARY(MAX)` (columna binaria, no texto). Sin key, se almacena JSON plano igualmente convertido a binario (solo desarrollo)
- Generar una key segura: `openssl rand -base64 24 | tr -d '=' | head -c 32`

## Cómo ejecutar

### Local sin Docker

Requiere acceso a SQL Server y a un broker Kafka.

```bash
npm install
# Copiar .env.example a .env y completar DB_HOST, DB_USER, DB_PASS, KAFKA_BROKER
# En producción: establecer AUDIT_API_KEY y AUDIT_PAYLOAD_KEY con valores seguros
npm run start:dev
```

### Local con Docker

Levanta Kafka y el servicio juntos con `docker-compose.dev.yml`:

```bash
docker compose -f docker-compose.dev.yml build
docker compose -f docker-compose.dev.yml up -d

# O build + up en un solo comando:
docker compose -f docker-compose.dev.yml up -d --build

# Para bajar:
docker compose -f docker-compose.dev.yml down
```

Si SQL Server corre en tu máquina, usar `DB_HOST=host.docker.internal` en `.env`. `KAFKA_BROKER` en `.env` puede ser cualquier valor — dentro del contenedor siempre se usa `kafka:9092` (red interna Docker).

### Producción

El `docker-compose.yml` lee los secretos desde Vault al arrancar. No se necesita `.env` en el servidor.

**Requisito:** Vault corriendo en `192.168.42.44:8200` (ver [HCE-vault-config](../HCE-vault-config/README.md)).

```bash
# El token está en HCE-vault-config/.env como TOKEN_LOGS_SERVICE
export VAULT_TOKEN=hvs.xxxx

docker compose down
docker compose build
docker compose up -d
```

Al arrancar, `entrypoint.sh` obtiene `DB_PASS`, `DB_HOST`, `KAFKA_EXTERNAL_HOST` y el resto de Vault. `KAFKA_BROKER=kafka:9092` lo fija el `docker-compose.yml` directamente (red interna Docker, no viene de Vault).

> **Nota:** `AUDIT_API_KEY` y `AUDIT_PAYLOAD_KEY` también deben agregarse a Vault (`secret/hce/nestjs/tch-audit-logger`) antes del primer deploy en producción.

Con GitHub Actions el token se pasa como variable de entorno desde GitHub Secrets (`TOKEN_LOGS_SERVICE`).

---

## Scripts disponibles

```bash
npm run start:dev   # desarrollo con hot-reload
npm run build       # compilar TypeScript
npm run start:prod  # ejecutar build
npm run test        # tests unitarios
npm run test:cov    # cobertura
```
