import type { QueryRunner } from 'typeorm';
import type { AuditEventData } from '../models/audit-event-data.interface';
import { AuditEvent }  from '../entities/audit-event.entity';
import { AuditTrace }  from '../entities/audit-trace.entity';
import { AuthSession } from '../entities/auth-session.entity';
import { AuthToken }   from '../entities/auth-token.entity';

export const AUDIT_REPOSITORY = Symbol('AUDIT_REPOSITORY');

export interface AuditEventFilters {
  userId?:       string;
  username?:     string;
  eventType?:    string;
  outcome?:      string;
  sourceSystem?: string;
  traceId?:      string;
  from?:         string;
  to?:           string;
  limit?:        number;
}

/**
 * Puerto hacia la persistencia de auditoría. saveAuditEvent recibe el
 * QueryRunner activo de la transacción iniciada en AuditUseCase.processEvent
 * (el use-case orquesta la transacción, el repositorio solo escribe en ella).
 */
export interface AuditRepository {
  saveAuditEvent(data: AuditEventData, qr: QueryRunner): Promise<void>;
  findEvents(filters: AuditEventFilters): Promise<AuditEvent[]>;
  findTrace(traceId: string): Promise<{ trace: AuditTrace | null; events: AuditEvent[] }>;
  findSession(sessionId: string): Promise<{ session: AuthSession | null; events: AuditEvent[]; tokens: AuthToken[] }>;
}
