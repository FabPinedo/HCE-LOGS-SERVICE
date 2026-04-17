import { Injectable, Inject, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, Between, FindManyOptions, QueryRunner } from 'typeorm';
import { AuthSession } from '../entities/auth-session.entity';
import { AuthToken }   from '../entities/auth-token.entity';
import { AuditEvent }  from '../entities/audit-event.entity';
import { AuditTrace }  from '../entities/audit-trace.entity';
import { AuditEventData }      from './audit-event-data.interface';
import { AUDIT_HANDLERS, IAuditEventHandler } from './handlers/audit-event-handler.interface';
import { PayloadCryptoService } from './payload-crypto.service';

export type { AuditEventData };

@Injectable()
export class AuditService {
  private readonly logger     = new Logger(AuditService.name);
  private readonly handlerMap: Map<string, IAuditEventHandler>;

  constructor(
    @Inject(AUDIT_HANDLERS)        private readonly handlers:    IAuditEventHandler[],
    private readonly dataSource:   DataSource,
    private readonly crypto:       PayloadCryptoService,
    // Repos solo para consultas HTTP (read-only, fuera de transacción)
    @InjectRepository(AuthSession) private readonly sessionRepo: Repository<AuthSession>,
    @InjectRepository(AuthToken)   private readonly tokenRepo:   Repository<AuthToken>,
    @InjectRepository(AuditEvent)  private readonly eventRepo:   Repository<AuditEvent>,
    @InjectRepository(AuditTrace)  private readonly traceRepo:   Repository<AuditTrace>,
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
      await this.saveAuditEvent(data, qr);
      await this.handlerMap.get(data.event_type?.toUpperCase() ?? '')?.handle(data, qr);
      await qr.commitTransaction();
    } catch (err: any) {
      await qr.rollbackTransaction();
      this.logger.error(`Error procesando evento ${data.event_type}: ${err?.message}`, err?.stack);
    } finally {
      await qr.release();
    }
  }

  // ── Persistencia central ──────────────────────────────────────────

  private async saveAuditEvent(data: AuditEventData, qr: QueryRunner): Promise<void> {
    const payload    = data.payload ?? {};
    const payloadStr = this.crypto.encrypt(payload);

    await qr.manager.save(AuditEvent, {
      event_type:        data.event_type,
      user_id:           data.user_id,
      username:          data.username,
      action:            data.action ?? data.message,
      outcome:           data.outcome,
      source_system:     data.source_system,
      ip_address:        data.ip_address,
      user_agent:        data.user_agent,
      trace_id:          data.trace_id,
      session_id:        data.session_id,
      payload_encrypted: payloadStr,
    });
  }

  // ── Consultas HTTP (read-only, sin transacción) ──────────────────

  async findEvents(filters: {
    userId?:       string;
    username?:     string;
    eventType?:    string;
    outcome?:      string;
    sourceSystem?: string;
    traceId?:      string;
    from?:         string;
    to?:           string;
    limit?:        number;
  }): Promise<AuditEvent[]> {
    const where: any = {};
    if (filters.userId)       where.user_id       = filters.userId;
    if (filters.username)     where.username       = filters.username;
    if (filters.eventType)    where.event_type     = filters.eventType;
    if (filters.outcome)      where.outcome        = filters.outcome;
    if (filters.sourceSystem) where.source_system  = filters.sourceSystem;
    if (filters.traceId)      where.trace_id       = filters.traceId;
    if (filters.from && filters.to) {
      where.timestamp = Between(new Date(filters.from), new Date(filters.to));
    }
    const opts: FindManyOptions<AuditEvent> = {
      where,
      order: { timestamp: 'DESC' },
      take:  Math.min(filters.limit ?? 200, 1000),
    };
    return this.eventRepo.find(opts);
  }

  async findTrace(traceId: string): Promise<{ trace: AuditTrace | null; events: AuditEvent[] }> {
    const [trace, events] = await Promise.all([
      this.traceRepo.findOne({ where: { trace_id: traceId } }),
      this.eventRepo.find({ where: { trace_id: traceId }, order: { timestamp: 'ASC' } }),
    ]);
    return { trace, events };
  }

  async findSession(sessionId: string): Promise<{ session: AuthSession | null; events: AuditEvent[]; tokens: AuthToken[] }> {
    const [session, events, tokens] = await Promise.all([
      this.sessionRepo.findOne({ where: { session_id: sessionId } }),
      this.eventRepo.find({ where: { session_id: sessionId }, order: { timestamp: 'ASC' } }),
      this.tokenRepo.find({ where: { session_id: sessionId } }),
    ]);
    return { session, events, tokens };
  }

  health(): Record<string, any> {
    return { status: 'UP', service: 'ms-lg-pruebas-kafka', timestamp: new Date().toISOString() };
  }
}
