import {
  Entity, PrimaryGeneratedColumn, Column,
} from 'typeorm';

/**
 * Token individual dentro de una sesión.
 * Registrado en TOKEN_REFRESH.
 */
@Entity('lg_auth_token')
export class AuthToken {
  @PrimaryGeneratedColumn('uuid')
  token_id!: string;

  @Column('uuid')
  session_id!: string;

  @Column({ length: 50 })
  token_type!: string;   // access | refresh

  @Column({ length: 255, nullable: true })
  token_hash?: string;

  @Column({ type: 'datetimeoffset', nullable: true })
  expires_at?: Date;
}
