import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthSession }  from '../entities/auth-session.entity';
import { AuthToken }    from '../entities/auth-token.entity';
import { AuditEvent }   from '../entities/audit-event.entity';
import { AuditTrace }   from '../entities/audit-trace.entity';
import { AuditConsumer }    from './audit.consumer';
import { AuditController }  from './audit.controller';
import { AuditService }     from './audit.service';
import { ApiKeyGuard }      from './guards/api-key.guard';
import { AUDIT_HANDLERS, IAuditEventHandler } from './handlers/audit-event-handler.interface';
import { LoginSuccessHandler }   from './handlers/login-success.handler';
import { LoginFailedHandler }    from './handlers/login-failed.handler';
import { LogoutHandler }         from './handlers/logout.handler';
import { TokenRefreshHandler }   from './handlers/token-refresh.handler';
import { GatewayRequestHandler } from './handlers/gateway-request.handler';

const EVENT_HANDLERS = [
  LoginSuccessHandler,
  LoginFailedHandler,
  LogoutHandler,
  TokenRefreshHandler,
  GatewayRequestHandler,
];

@Module({
  imports: [
    // UserEntity ya no necesita forFeature — los handlers usan qr.manager directamente
    TypeOrmModule.forFeature([AuthSession, AuthToken, AuditEvent, AuditTrace]),
  ],
  controllers: [AuditConsumer, AuditController],
  providers: [
    ApiKeyGuard,
    ...EVENT_HANDLERS,
    {
      provide:    AUDIT_HANDLERS,
      useFactory: (...handlers: IAuditEventHandler[]) => handlers,
      inject:     EVENT_HANDLERS,
    },
    AuditService,
  ],
})
export class AuditModule {}
