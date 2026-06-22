import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, FindManyOptions, QueryRunner } from 'typeorm';
import { AuthSession } from '../../domain/entities/auth-session.entity';
import { AuthToken }   from '../../domain/entities/auth-token.entity';
import { AuditEvent }  from '../../domain/entities/audit-event.entity';
import { AuditTrace }  from '../../domain/entities/audit-trace.entity';
import { AuditEventData } from '../../domain/models/audit-event-data.interface';
import { AuditRepository, AuditEventFilters } from '../../domain/repositories/audit.repository';
import { PayloadCryptoService } from '../crypto/payload-crypto.service';

@Injectable()
export class AuditTypeOrmRepository implements AuditRepository {
  constructor(
    private readonly crypto:       PayloadCryptoService,
    @InjectRepository(AuthSession) private readonly sessionRepo: Repository<AuthSession>,
    @InjectRepository(AuthToken)   private readonly tokenRepo:   Repository<AuthToken>,
    @InjectRepository(AuditEvent)  private readonly eventRepo:   Repository<AuditEvent>,
    @InjectRepository(AuditTrace)  private readonly traceRepo:   Repository<AuditTrace>,
  ) {}

  async saveAuditEvent(data: AuditEventData, qr: QueryRunner): Promise<void> {
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

  async findEvents(filters: AuditEventFilters): Promise<AuditEvent[]> {
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
}
