import { Controller, Get, Param, Query } from '@nestjs/common';
import { AuditService } from './audit.service';

@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

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
    return this.auditService.findEvents({
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
    return this.auditService.findTrace(traceId);
  }

  /**
   * GET /audit/session/:sessionId
   * Devuelve la sesión: AUTH_SESSION + eventos + tokens
   */
  @Get('session/:sessionId')
  findSession(@Param('sessionId') sessionId: string) {
    return this.auditService.findSession(sessionId);
  }

  @Get('health')
  health() {
    return this.auditService.health();
  }
}
