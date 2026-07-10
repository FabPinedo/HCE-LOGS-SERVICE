import { Controller, Get, Param, Query, UseGuards, BadRequestException } from '@nestjs/common';
import { AuditUseCase } from '../../application/use-cases/Audit.use-case';
import { ApiKeyGuard }  from '../guards/api-key.guard';

// trace_id/session_id son uniqueidentifier de SQL Server (NEWSEQUENTIALID() / provisto por otro
// servicio) — no garantizan los nibbles de version/variante que exige RFC4122, así que se valida
// solo la forma (8-4-4-4-12 hex), no con @IsUUID()/ParseUUIDPipe (ver mismo fix en
// ms-bs-core-emergency-monitor y ms-bs-master-organization).
const GUID_SHAPE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

@Controller('audit')
@UseGuards(ApiKeyGuard)
export class AuditController {
  constructor(private readonly auditUseCase: AuditUseCase) {}

  /**
   * GET /audit/events
   * Filtros: userId, username, eventType, outcome, sourceSystem, traceId, from, to, limit
   */
  @Get('events')
  findEvents(
    @Query('userId')       userId?:       string,
    @Query('username')     username?:     string,
    @Query('eventType')    eventType?:    string,
    @Query('outcome')      outcome?:      string,
    @Query('sourceSystem') sourceSystem?: string,
    @Query('traceId')      traceId?:      string,
    @Query('from')         from?:         string,
    @Query('to')           to?:           string,
    @Query('limit')        limit?:        string,
  ) {
    return this.auditUseCase.findEvents({
      userId, username, eventType, outcome, sourceSystem, traceId, from, to,
      limit: limit ? Number(limit) : 200,
    });
  }

  /**
   * GET /audit/trace/:traceId
   * Devuelve la traza completa: AUDIT_TRACE + todos los AUDIT_EVENT con ese trace_id
   */
  @Get('trace/:traceId')
  findTrace(@Param('traceId') traceId: string) {
    if (!GUID_SHAPE.test(traceId)) throw new BadRequestException('traceId debe tener formato de GUID');
    return this.auditUseCase.findTrace(traceId);
  }

  /**
   * GET /audit/session/:sessionId
   * Devuelve la sesión: AUTH_SESSION + eventos + tokens
   */
  @Get('session/:sessionId')
  findSession(@Param('sessionId') sessionId: string) {
    if (!GUID_SHAPE.test(sessionId)) throw new BadRequestException('sessionId debe tener formato de GUID');
    return this.auditUseCase.findSession(sessionId);
  }

  @Get('health')
  health() {
    return this.auditUseCase.health();
  }
}
