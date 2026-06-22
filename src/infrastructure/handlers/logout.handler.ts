import { Injectable } from '@nestjs/common';
import { QueryRunner } from 'typeorm';
import { AuthSession } from '../../domain/entities/auth-session.entity';
import type { AuditEventData } from '../../domain/models/audit-event-data.interface';
import type { IAuditEventHandler } from '../../domain/handlers/audit-event-handler.interface';

@Injectable()
export class LogoutHandler implements IAuditEventHandler {
  readonly eventType = 'LOGOUT';

  async handle(data: AuditEventData, qr: QueryRunner): Promise<void> {
    if (data.session_id) {
      await qr.manager.update(
        AuthSession,
        { session_id: data.session_id },
        { status: 'revoked' },
      );
    }
  }
}
