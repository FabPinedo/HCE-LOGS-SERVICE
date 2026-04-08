import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, FindManyOptions } from 'typeorm';
import { UserEntity }  from '../entities/user.entity';
import { AuthSession } from '../entities/auth-session.entity';
import { AuthToken }   from '../entities/auth-token.entity';
import { AuditEvent }  from '../entities/audit-event.entity';
import { AuditTrace }  from '../entities/audit-trace.entity';
import { randomUUID }  from 'crypto';

export interface AuditEventData {
  event_type:    string;
  source_system?: string;
  trace_id?:     string;
  user_id?:      string;
  username?:     string;
  session_id?:   string;
  action?:       string;
  outcome?:      string;
  level?:        string;
  message?:      string;
  ip_address?:   string;
  user_agent?:   string;
  reason?:       string;
  payload?:      Record<string, any>;
  timestamp?:    string;
  // campos específicos de gateway
  request_path?: string;
  method?:       string;
  correlation_id?: string;
  // campos específicos de token
  token_type?:   string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(UserEntity)  private readonly userRepo:    Repository<UserEntity>,
    @InjectRepository(AuthSession) private readonly sessionRepo: Repository<AuthSession>,
    @InjectRepository(AuthToken)   private readonly tokenRepo:   Repository<AuthToken>,
    @InjectRepository(AuditEvent)  private readonly eventRepo:   Repository<AuditEvent>,
    @InjectRepository(AuditTrace)  private readonly traceRepo:   Repository<AuditTrace>,
  ) {}

  /**
   * Punto de entrada principal.
   * Siempre guarda en AUDIT_EVENT y luego enruta a tablas específicas.
   */
  async processEvent(data: AuditEventData): Promise<void> {
    await this.saveAuditEvent(data);

    const type = data.event_type?.toUpperCase() ?? '';

    if (type === 'LOGIN_SUCCESS') {
      await this.handleLoginSuccess(data);
    } else if (type === 'LOGIN_FAILED') {
      await this.handleLoginFailed(data);
    } else if (type === 'LOGOUT') {
      await this.handleLogout(data);
    } else if (type === 'TOKEN_REFRESH') {
      await this.handleTokenRefresh(data);
    } else if (type === 'GATEWAY_REQUEST') {
      await this.handleGatewayRequest(data);
    }
    // SERVICE_CALL y otros solo van a AUDIT_EVENT (ya guardado arriba)
  }

  // ── Handlers por event_type ──────────────────────────────────────

  private async handleLoginSuccess(data: AuditEventData): Promise<void> {
    // Upsert USER — registra o actualiza el usuario
    if (data.user_id && data.username) {
      await this.userRepo.upsert(
        { user_id: data.user_id, username: data.username, status: 'active' },
        ['user_id'],
      );
    }
    // Crear AUTH_SESSION
    if (data.session_id) {
      await this.sessionRepo.upsert(
        {
          session_id: data.session_id,
          user_id:    data.user_id ?? 'unknown',
          status:     'active',
        },
        ['session_id'],
      );
    }
  }

  private async handleLoginFailed(data: AuditEventData): Promise<void> {
    // Solo registrar si conocemos al usuario (puede ser usuario inexistente)
    if (data.user_id && data.username) {
      await this.userRepo.upsert(
        { user_id: data.user_id, username: data.username, status: 'active' },
        ['user_id'],
      );
    }
  }

  private async handleLogout(data: AuditEventData): Promise<void> {
    if (data.session_id) {
      await this.sessionRepo.update(
        { session_id: data.session_id },
        { status: 'revoked' },
      );
    }
  }

  private async handleTokenRefresh(data: AuditEventData): Promise<void> {
    if (data.session_id) {
      await this.tokenRepo.save({
        token_id:   randomUUID(),
        session_id: data.session_id,
        token_type: data.token_type ?? 'access',
      });
    }
  }

  private async handleGatewayRequest(data: AuditEventData): Promise<void> {
    // Crear AUDIT_TRACE si tiene trace_id
    if (data.trace_id) {
      await this.traceRepo.upsert(
        {
          trace_id:       data.trace_id,
          correlation_id: data.correlation_id,
          request_path:   data.action ?? data.request_path,
          method:         data.method,
        },
        ['trace_id'],
      );
    }
  }

  // ── Persistencia central ─────────────────────────────────────────

  private async saveAuditEvent(data: AuditEventData): Promise<void> {
    const payload = data.payload ?? {};
    // TODO producción: cifrar payload con AES-256 antes de persistir
    // import { createCipheriv, randomBytes } from 'crypto';
    const payloadStr = Object.keys(payload).length > 0
      ? JSON.stringify(payload)
      : undefined;

    await this.eventRepo.save({
      event_type:        data.event_type,
      user_id:           data.user_id,
      username:          data.username,
      action:            data.action     ?? data.message,
      outcome:           data.outcome,
      source_system:     data.source_system,
      ip_address:        data.ip_address,
      user_agent:        data.user_agent,
      trace_id:          data.trace_id,
      payload_encrypted: payloadStr,
    });
  }

  // ── Consultas HTTP ───────────────────────────────────────────────

  async findEvents(filters: {
    userId?:      string;
    username?:    string;
    eventType?:   string;
    outcome?:     string;
    sourceSystem?: string;
    traceId?:     string;
    from?:        string;
    to?:          string;
    limit?:       number;
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
      this.eventRepo.find({ where: { user_id: sessionId }, order: { timestamp: 'ASC' } }),
      this.tokenRepo.find({ where: { session_id: sessionId } }),
    ]);
    return { session, events, tokens };
  }

  health(): Record<string, any> {
    return { status: 'UP', service: 'ms-lg-pruebas-kafka', timestamp: new Date().toISOString() };
  }
}
