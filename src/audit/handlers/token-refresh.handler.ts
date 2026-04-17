import { Injectable } from '@nestjs/common';
import { QueryRunner } from 'typeorm';
import { randomUUID } from 'crypto';
import { AuthToken } from '../../entities/auth-token.entity';
import type { AuditEventData } from '../audit-event-data.interface';
import type { IAuditEventHandler } from './audit-event-handler.interface';

@Injectable()
export class TokenRefreshHandler implements IAuditEventHandler {
  readonly eventType = 'TOKEN_REFRESH';

  async handle(data: AuditEventData, qr: QueryRunner): Promise<void> {
    if (data.session_id) {
      await qr.manager.save(AuthToken, {
        token_id:   randomUUID(),
        session_id: data.session_id,
        token_type: data.token_type ?? 'access',
      });
    }
  }
}
