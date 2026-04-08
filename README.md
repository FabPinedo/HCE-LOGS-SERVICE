# ms-lg-pruebas-kafka

> Audit Logger Service generado por **Jarvis Platform** — 2/4/2026

## Modelo de datos

```
lg_user          — copia denormalizada del usuario
lg_auth_session  — sesiones de autenticación
lg_auth_token    — tokens por sesión
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
| SERVICE_CALL  | ✓ | — | — | — | — |

## Endpoints HTTP

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | /audit/events | Consultar eventos (filtros: userId, username, eventType, outcome, sourceSystem, traceId, from, to, limit) |
| GET | /audit/trace/:traceId | Traza completa — todos los eventos de un request |
| GET | /audit/session/:sessionId | Sesión + eventos + tokens |
| GET | /audit/health | Health check |

## Ejemplos de consulta

```bash
# Todos los logins fallidos de las últimas 24h
GET /audit/events?eventType=LOGIN_FAILED&from=2024-01-01T00:00:00Z

# Seguir un request a través de todos los microservicios
GET /audit/trace/abc-123-uuid

# Ver sesión de un usuario
GET /audit/session/session-uuid-aqui

# Eventos de un usuario específico
GET /audit/events?userId=user-uuid&limit=50
```

## Instalación

```bash
npm install
cp .env.example .env
# Configurar DB_HOST, DB_USER, DB_PASS, DB_NAME
# Las tablas se crean automáticamente en el primer arranque
npm run start:dev
```

## payload_encrypted

Actualmente el payload se guarda como JSON plano.
Para cumplir con GDPR/HIPAA, cifrar en `audit.service.ts → saveAuditEvent()`
usando `crypto.createCipheriv('aes-256-gcm', key, iv)`.
