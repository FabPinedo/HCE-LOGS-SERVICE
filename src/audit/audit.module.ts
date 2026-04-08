import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity }   from '../entities/user.entity';
import { AuthSession }  from '../entities/auth-session.entity';
import { AuthToken }    from '../entities/auth-token.entity';
import { AuditEvent }   from '../entities/audit-event.entity';
import { AuditTrace }   from '../entities/audit-trace.entity';
import { AuditConsumer }    from './audit.consumer';
import { AuditController }  from './audit.controller';
import { AuditService }     from './audit.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserEntity,
      AuthSession,
      AuthToken,
      AuditEvent,
      AuditTrace,
    ]),
  ],
  controllers: [AuditConsumer, AuditController],
  providers:   [AuditService],
})
export class AuditModule {}
