import { Injectable } from '@nestjs/common';
import { QueryRunner } from 'typeorm';
import { UserEntity } from '../../entities/user.entity';
import type { AuditEventData } from '../audit-event-data.interface';
import type { IAuditEventHandler } from './audit-event-handler.interface';

@Injectable()
export class LoginFailedHandler implements IAuditEventHandler {
  readonly eventType = 'LOGIN_FAILED';

  async handle(data: AuditEventData, qr: QueryRunner): Promise<void> {
    if (data.user_id && data.username) {
      await qr.manager.upsert(
        UserEntity,
        { user_id: data.user_id, username: data.username, status: 'active' },
        ['user_id'],
      );
    }
  }
}
