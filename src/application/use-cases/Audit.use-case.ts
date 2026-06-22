import { Injectable, Inject, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AuditEventData } from '../../domain/models/audit-event-data.interface';
import { AUDIT_HANDLERS, IAuditEventHandler } from '../../domain/handlers/audit-event-handler.interface';
import { AUDIT_REPOSITORY, AuditRepository, AuditEventFilters } from '../../domain/repositories/audit.repository';

export type { AuditEventData };

@Injectable()
export class AuditUseCase {
  private readonly logger     = new Logger(AuditUseCase.name);
  private readonly handlerMap: Map<string, IAuditEventHandler>;

  constructor(
    @Inject(AUDIT_HANDLERS)          private readonly handlers:       IAuditEventHandler[],
    private readonly dataSource:     DataSource,
    @Inject(AUDIT_REPOSITORY)        private readonly auditRepository: AuditRepository,
  ) {
    this.handlerMap = new Map(handlers.map(h => [h.eventType, h]));
  }

  /**
   * Punto de entrada del consumer.
   * Ejecuta saveAuditEvent + handler en una sola transacción.
   * Si el handler falla, el evento de auditoría también se revierte — consistencia total.
   */
  async processEvent(data: AuditEventData): Promise<void> {
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      await this.auditRepository.saveAuditEvent(data, qr);
      await this.handlerMap.get(data.event_type?.toUpperCase() ?? '')?.handle(data, qr);
      await qr.commitTransaction();
    } catch (err: any) {
      await qr.rollbackTransaction();
      this.logger.error(`Error procesando evento ${data.event_type}: ${err?.message}`, err?.stack);
    } finally {
      await qr.release();
    }
  }

  // ── Consultas HTTP (read-only, sin transacción) ──────────────────

  findEvents(filters: AuditEventFilters) {
    return this.auditRepository.findEvents(filters);
  }

  findTrace(traceId: string) {
    return this.auditRepository.findTrace(traceId);
  }

  findSession(sessionId: string) {
    return this.auditRepository.findSession(sessionId);
  }

  health(): Record<string, any> {
    return { status: 'UP', service: 'ms-lg-pruebas-kafka', timestamp: new Date().toISOString() };
  }
}
