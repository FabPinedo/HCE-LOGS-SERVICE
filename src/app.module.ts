import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { dbConfig } from './config/db.config';
import { HealthModule } from './health/health.module';

import { AuthSession } from './domain/entities/auth-session.entity';
import { AuthToken }   from './domain/entities/auth-token.entity';
import { AuditEvent }  from './domain/entities/audit-event.entity';
import { AuditTrace }  from './domain/entities/audit-trace.entity';

import { AUDIT_HANDLERS, IAuditEventHandler } from './domain/handlers/audit-event-handler.interface';
import { AUDIT_REPOSITORY } from './domain/repositories/audit.repository';

import { AuditUseCase } from './application/use-cases/Audit.use-case';

import { AuditConsumer }   from './infrastructure/consumers/Audit.consumer';
import { AuditController } from './infrastructure/controllers/Audit.controller';
import { AuditTypeOrmRepository } from './infrastructure/persistence/audit.typeorm.repository';
import { PayloadCryptoService } from './infrastructure/crypto/payload-crypto.service';
import { ApiKeyGuard } from './infrastructure/guards/api-key.guard';
import { LoginSuccessHandler }   from './infrastructure/handlers/login-success.handler';
import { LoginFailedHandler }    from './infrastructure/handlers/login-failed.handler';
import { LogoutHandler }         from './infrastructure/handlers/logout.handler';
import { TokenRefreshHandler }   from './infrastructure/handlers/token-refresh.handler';
import { GatewayRequestHandler } from './infrastructure/handlers/gateway-request.handler';

const EVENT_HANDLERS = [
  LoginSuccessHandler,
  LoginFailedHandler,
  LogoutHandler,
  TokenRefreshHandler,
  GatewayRequestHandler,
];

@Module({
  imports: [
    HealthModule,
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports:    [HealthModule, ConfigModule],
      useFactory: (cfg: ConfigService) => dbConfig(cfg),
      inject:     [ConfigService],
    }),
    // UserEntity ya no necesita forFeature — los handlers usan qr.manager directamente
    TypeOrmModule.forFeature([AuthSession, AuthToken, AuditEvent, AuditTrace]),
  ],
  controllers: [AuditConsumer, AuditController],
  providers: [
    ApiKeyGuard,
    PayloadCryptoService,
    ...EVENT_HANDLERS,
    {
      provide:    AUDIT_HANDLERS,
      useFactory: (...handlers: IAuditEventHandler[]) => handlers,
      inject:     EVENT_HANDLERS,
    },
    AuditUseCase,
    AuditTypeOrmRepository,
    { provide: AUDIT_REPOSITORY, useClass: AuditTypeOrmRepository },
  ],
})
export class AppModule {}
