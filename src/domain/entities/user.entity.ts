import {
  Entity, PrimaryColumn, Column, CreateDateColumn,
} from 'typeorm';

/**
 * Copia denormalizada del usuario al momento del evento.
 * Permanece válida aunque el usuario sea eliminado del sistema origen.
 */
@Entity('lg_user')
export class UserEntity {
  // No es un UUID: el sistema de auth identifica usuarios por username (ej. "fpinedo"),
  // igual que AuditEvent.user_id (varchar) — debe coincidir con ese mismo tipo.
  @PrimaryColumn({ length: 255 })
  user_id!: string;

  @Column({ length: 255 })
  username!: string;

  @Column({ length: 50, default: 'active' })
  status!: string;

  @CreateDateColumn()
  created_at!: Date;
}
