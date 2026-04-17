import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { AuditService }      from './audit.service';
import { KAFKA_AUDIT_TOPIC } from './kafka-topic.config';

@Controller()
export class AuditConsumer {
  private readonly logger = new Logger(AuditConsumer.name);

  constructor(private readonly auditService: AuditService) {}

  @EventPattern(KAFKA_AUDIT_TOPIC)
  async handleAuditEvent(@Payload() message: any): Promise<void> {
    // Kafka envuelve el mensaje en { key, value, headers, ... }
    const data = message?.value ?? message;
    try {
      await this.auditService.processEvent(
        typeof data === 'string' ? JSON.parse(data) : data,
      );
    } catch (err: any) {
      this.logger.error(`Error procesando evento: ${err?.message}`, err?.stack);
    }
  }
}
