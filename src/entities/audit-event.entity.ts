import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index,
} from 'typeorm';

/**
 * Registro central de auditoría.
 * Todos los eventos de todos los microservicios llegan aquí.
 */
@Entity('lg_audit_event')
@Index(['user_id'])
@Index(['trace_id'])
@Index(['event_type'])
@Index(['timestamp'])
export class AuditEvent {
  @PrimaryGeneratedColumn('uuid')
  event_id!: string;

  @Column({ length: 100 })
  event_type!: string;   // LOGIN_SUCCESS | LOGIN_FAILED | GATEWAY_REQUEST | SERVICE_CALL | LOGOUT | TOKEN_REFRESH

  @Column({ length: 255, nullable: true })
  user_id?: string;

  @Column({ length: 255, nullable: true })
  username?: string;

  @Column({ length: 500, nullable: true })
  action?: string;

  @Column({ length: 50, nullable: true })
  outcome?: string;      // SUCCESS | FAILED | ERROR

  @Column({ length: 255, nullable: true })
  source_system?: string;

  @Column({ length: 100, nullable: true })
  ip_address?: string;

  @Column({ length: 500, nullable: true })
  user_agent?: string;

  @Column({ length: 100, nullable: true })
  trace_id?: string;

  // payload_encrypted: en producción cifrar con AES-256 antes de persistir.
  // Por ahora se almacena como JSON plano. Ver: crypto.createCipheriv()
  @Column({ type: 'text', nullable: true })
  payload_encrypted?: string;

  @CreateDateColumn({ type: 'datetimeoffset' })
  timestamp!: Date;
}
