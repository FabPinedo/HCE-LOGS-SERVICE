import {
  Entity, PrimaryGeneratedColumn, Column, Index, ManyToOne, JoinColumn,
} from 'typeorm';
import { AuthSession } from './auth-session.entity';

/**
 * Token individual dentro de una sesión.
 * Registrado en TOKEN_REFRESH.
 */
@Entity('AuthToken')
export class AuthToken {
  @PrimaryGeneratedColumn('uuid')
  token_id!: string;

  // Columna FK explícita — se mantiene como string plano porque otros puntos
  // del código (ej. login-success.handler.ts) la usan directamente sin cargar
  // la relación. @JoinColumn reutiliza esta misma columna en vez de duplicarla.
  @Index()
  @Column('uuid')
  session_id!: string;

  @ManyToOne(() => AuthSession)
  @JoinColumn({ name: 'session_id' })
  session?: AuthSession;

  @Column({ length: 50 })
  token_type!: string;   // access | refresh

  @Column({ length: 255, nullable: true })
  token_hash?: string;

  @Column({ type: 'datetimeoffset', nullable: true })
  expires_at?: Date;
}
