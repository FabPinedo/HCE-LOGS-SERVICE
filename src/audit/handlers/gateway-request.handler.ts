import { Injectable } from '@nestjs/common';
import { QueryRunner } from 'typeorm';
import { AuditTrace } from '../../entities/audit-trace.entity';
import type { AuditEventData } from '../audit-event-data.interface';
import type { IAuditEventHandler } from './audit-event-handler.interface';

@Injectable()
export class GatewayRequestHandler implements IAuditEventHandler {
  readonly eventType = 'GATEWAY_REQUEST';

  async handle(data: AuditEventData, qr: QueryRunner): Promise<void> {
    if (data.trace_id) {
      await qr.manager.upsert(
        AuditTrace,
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
}
