import type { QueryRunner } from 'typeorm';
import type { AuditEventData } from '../audit-event-data.interface';

export const AUDIT_HANDLERS = 'AUDIT_HANDLERS';

/**
 * Strategy pattern para manejo de eventos de auditoría.
 * Cada handler recibe el QueryRunner activo de la transacción iniciada
 * en AuditService.processEvent, garantizando atomicidad entre
 * saveAuditEvent y la lógica de dominio del handler.
 *
 * Para agregar un nuevo event_type:
 *   1. Crear handler que implemente esta interfaz
 *   2. Agregarlo a EVENT_HANDLERS en AuditModule
 *   No se modifica AuditService (OCP).
 */
export interface IAuditEventHandler {
  readonly eventType: string;
  handle(data: AuditEventData, qr: QueryRunner): Promise<void>;
}
