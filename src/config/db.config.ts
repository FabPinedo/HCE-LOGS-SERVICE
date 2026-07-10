// db.config.ts — Configuración de base de datos (mssql)
// Las credenciales se leen desde variables de entorno en tiempo de ejecución
import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { UserEntity }  from '../domain/entities/user.entity';
import { AuthSession } from '../domain/entities/auth-session.entity';
import { AuthToken }   from '../domain/entities/auth-token.entity';
import { AuditEvent }  from '../domain/entities/audit-event.entity';
import { AuditTrace }  from '../domain/entities/audit-trace.entity';

export function dbConfig(cfg: ConfigService): TypeOrmModuleOptions {
  return {
    type:     'mssql',
    host:     cfg.get<string>('DB_HOST', 'localhost'),
    port:     cfg.get<number>('DB_PORT', 1433),
    username: cfg.get<string>('DB_USER'),
    password: cfg.get<string>('DB_PASS'),
    database: cfg.get<string>('DB_NAME', 'HCE_AUDIT'),
    options: {
      encrypt:                false,
      trustServerCertificate: true,
      connectTimeout:         30000,
      instanceName: cfg.get<string>('DB_INSTANCE', 'INST01'),
    },
    pool: { max: 25, min: 0 },
    entities: [UserEntity, AuthSession, AuthToken, AuditEvent, AuditTrace],
    // synchronize siempre false: el esquema de HCE_AUDIT se administra por DDL/migraciones,
    // no por auto-sync de TypeORM (riesgo de alterar/dropear tablas de auditoría en runtime).
    synchronize: false,
    logging: cfg.get('NODE_ENV') !== 'production',
  };
}
