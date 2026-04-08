import {
  Entity, PrimaryColumn, Column, CreateDateColumn, Index,
} from 'typeorm';

/**
 * Traza distribuida de un request a través de múltiples microservicios.
 * Permite correlacionar todos los AUDIT_EVENT de una misma operación.
 */
@Entity('lg_audit_trace')
@Index(['correlation_id'])
export class AuditTrace {
  @PrimaryColumn('uuid')
  trace_id!: string;

  @Column({ length: 255, nullable: true })
  correlation_id?: string;   // agrupa múltiples traces de una operación de negocio

  @Column({ length: 1000, nullable: true })
  request_path?: string;

  @Column({ length: 20, nullable: true })
  method?: string;

  @CreateDateColumn({ type: 'datetimeoffset' })
  created_at!: Date;
}
