import {
  Entity, PrimaryColumn, Column, CreateDateColumn, Index, ManyToOne, JoinColumn,
} from 'typeorm';
import { UserEntity } from './user.entity';

/**
 * Sesión de autenticación.
 * Creada en LOGIN_SUCCESS, actualizada en LOGOUT.
 */
@Entity('AuthSession')
export class AuthSession {
  @PrimaryColumn('uuid')
  session_id!: string;

  // No es un UUID: ver comentario en UserEntity.user_id.
  // Columna FK explícita hacia AppUser.user_id — se mantiene como string plano
  // porque otros puntos del código (ej. login-success.handler.ts) la usan
  // directamente sin cargar la relación. @JoinColumn reutiliza esta misma
  // columna en vez de duplicarla.
  @Index()
  @Column({ length: 255 })
  user_id!: string;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'user_id' })
  user?: UserEntity;

  @Column({ length: 255, nullable: true })
  token_hash?: string;

  @Column({ length: 255, nullable: true })
  refresh_token_hash?: string;

  @CreateDateColumn({ type: 'datetimeoffset', default: () => 'SYSDATETIMEOFFSET()' })
  issued_at!: Date;

  @Column({ type: 'datetimeoffset', nullable: true })
  expires_at?: Date;

  @Column({ length: 50, default: 'active' })
  status!: string;   // active | revoked | expired
}
