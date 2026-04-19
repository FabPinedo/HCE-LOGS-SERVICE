// db.config.ts — Configuración de base de datos (mssql)
// Las credenciales se leen desde variables de entorno en tiempo de ejecución
import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { UserEntity }  from '../entities/user.entity';
import { AuthSession } from '../entities/auth-session.entity';
import { AuthToken }   from '../entities/auth-token.entity';
import { AuditEvent }  from '../entities/audit-event.entity';
import { AuditTrace }  from '../entities/audit-trace.entity';

export function dbConfig(cfg: ConfigService): TypeOrmModuleOptions {
  return {
    type:     'mssql',
    host:     cfg.get<string>('DB_HOST', 'localhost'),
    port:     cfg.get<number>('DB_PORT', 1433),
    username: cfg.get<string>('DB_USER'),
    password: cfg.get<string>('DB_PASS'),
    database: cfg.get<string>('DB_NAME', 'audit_db'),
    options: {
      encrypt:                false,
      trustServerCertificate: true,
      connectTimeout:         30000,
      instanceName: cfg.get<string>('DB_INSTANCE', 'INST01'),
    },
    pool: { max: 25, min: 0 },
    entities: [UserEntity, AuthSession, AuthToken, AuditEvent, AuditTrace],
    // synchronize: true crea las tablas automáticamente en dev.
    // En producción usar migraciones TypeORM.
    synchronize: cfg.get('NODE_ENV') === 'production',
    logging: cfg.get('NODE_ENV') === 'production',
  };
}
