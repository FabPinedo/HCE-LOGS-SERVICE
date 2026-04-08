import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { dbConfig } from './config/db.config';
import { AuditModule } from './audit/audit.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports:    [ConfigModule],
      useFactory: (cfg: ConfigService) => dbConfig(cfg),
      inject:     [ConfigService],
    }),
    AuditModule,
  ],
})
export class AppModule {}
