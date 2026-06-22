import type { QueryRunner } from 'typeorm';
import type { AuditEventData } from '../models/audit-event-data.interface';

export const AUDIT_HANDLERS = 'AUDIT_HANDLERS';

/**
 * Strategy pattern para manejo de eventos de auditoría.
 * Cada handler recibe el QueryRunner activo de la transacción iniciada
 * en AuditUseCase.processEvent, garantizando atomicidad entre
 * saveAuditEvent y la lógica de dominio del handler.
 *
 * Para agregar un nuevo event_type:
 *   1. Crear handler que implemente esta interfaz en infrastructure/handlers
 *   2. Agregarlo a EVENT_HANDLERS en app.module.ts
 *   No se modifica AuditUseCase (OCP).
 */
export interface IAuditEventHandler {
  readonly eventType: string;
  handle(data: AuditEventData, qr: QueryRunner): Promise<void>;
}
