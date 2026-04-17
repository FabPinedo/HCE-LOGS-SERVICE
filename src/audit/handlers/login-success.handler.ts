import { Injectable } from '@nestjs/common';
import { QueryRunner } from 'typeorm';
import { UserEntity }  from '../../entities/user.entity';
import { AuthSession } from '../../entities/auth-session.entity';
import type { AuditEventData } from '../audit-event-data.interface';
import type { IAuditEventHandler } from './audit-event-handler.interface';

@Injectable()
export class LoginSuccessHandler implements IAuditEventHandler {
  readonly eventType = 'LOGIN_SUCCESS';

  async handle(data: AuditEventData, qr: QueryRunner): Promise<void> {
    if (data.user_id && data.username) {
      await qr.manager.upsert(
        UserEntity,
        { user_id: data.user_id, username: data.username, status: 'active' },
        ['user_id'],
      );
    }
    if (data.session_id) {
      await qr.manager.upsert(
        AuthSession,
        {
          session_id: data.session_id,
          user_id:    data.user_id ?? 'unknown',
          status:     'active',
        },
        ['session_id'],
      );
    }
  }
}
