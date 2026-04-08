import {
  Entity, PrimaryColumn, Column, CreateDateColumn,
} from 'typeorm';

/**
 * Copia denormalizada del usuario al momento del evento.
 * Permanece válida aunque el usuario sea eliminado del sistema origen.
 */
@Entity('lg_user')
export class UserEntity {
  @PrimaryColumn('uuid')
  user_id!: string;

  @Column({ length: 255 })
  username!: string;

  @Column({ length: 50, default: 'active' })
  status!: string;

  @CreateDateColumn()
  created_at!: Date;
}
