/**
 * Constante del topic Kafka evaluada al inicio del proceso.
 * En Docker las env vars están disponibles antes de cualquier import,
 * por lo que process.env es seguro aquí.
 *
 * Para desarrollo local con .env: iniciar con:
 *   NODE_OPTIONS=--require dotenv/config ts-node src/main.ts
 */
export const KAFKA_AUDIT_TOPIC = process.env['KAFKA_TOPIC'] ?? 'platform.logs';
