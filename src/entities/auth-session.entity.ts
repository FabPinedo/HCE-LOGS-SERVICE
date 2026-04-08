import {
  Entity, PrimaryColumn, Column, CreateDateColumn,
} from 'typeorm';

/**
 * Sesión de autenticación.
 * Creada en LOGIN_SUCCESS, actualizada en LOGOUT.
 */
@Entity('lg_auth_session')
export class AuthSession {
  @PrimaryColumn('uuid')
  session_id!: string;

  @Column('uuid')
  user_id!: string;

  @Column({ length: 255, nullable: true })
  token_hash?: string;

  @Column({ length: 255, nullable: true })
  refresh_token_hash?: string;

  @CreateDateColumn()
  issued_at!: Date;

  @Column({ type: 'datetimeoffset', nullable: true })
  expires_at?: Date;

  @Column({ length: 50, default: 'active' })
  status!: string;   // active | revoked | expired
}
