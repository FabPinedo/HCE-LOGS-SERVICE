import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index,
} from 'typeorm';

/**
 * Registro central de auditoría.
 * Todos los eventos de todos los microservicios llegan aquí.
 */
@Entity('AuditEvent')
@Index(['user_id'])
@Index(['trace_id'])
@Index(['event_type'])
@Index(['timestamp'])
@Index(['session_id'])
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

  // uniqueidentifier (no varchar): normalizado para que coincida con el tipo
  // de AuthSession.session_id / AuthToken.session_id — evita joins/comparaciones
  // no-sargables. Deliberadamente SIN FK/relación hacia AuthSession: AuditEvent
  // es append-only con retención regulatoria, AuthSession es rotativa/purgable,
  // y una FK síncrona acoplaría latencia de escritura del sumidero de auditoría
  // de mayor volumen a validación referencial. Mismo patrón que AuthToken.session_id
  // tenía antes de agregarle su relación (índice simple, sin integridad referencial).
  @Column({ type: 'uuid', nullable: true })
  session_id?: string;

  // payload_encrypted: cifrado AES-256-GCM antes de persistir (ver PayloadCryptoService).
  // Almacenado como VARBINARY(MAX) — el string base64(iv).base64(tag).base64(ciphertext)
  // producido por PayloadCryptoService.encrypt() se convierte a Buffer antes de guardar.
  // select: false — decisión de producto: este campo NUNCA se expone por la API HTTP
  // (ni cifrado ni descifrado). TypeORM lo excluye por defecto de find()/findOne() en
  // todos los repositorios (findEvents/findTrace/findSession), sin necesidad de mapear
  // cada endpoint por separado. saveAuditEvent() sigue escribiéndolo sin problema porque
  // `select: false` solo afecta lecturas, no inserts vía qr.manager.save(). Si en el
  // futuro se necesita leerlo internamente, usar QueryBuilder + .addSelect('event.payload_encrypted')
  // explícitamente en ese caso puntual — nunca en un método que alimente una respuesta HTTP.
  @Column({ type: 'varbinary', length: 'MAX' as unknown as number, nullable: true, select: false })
  payload_encrypted?: Buffer;

  @CreateDateColumn({ type: 'datetimeoffset', default: () => 'SYSDATETIMEOFFSET()' })
  timestamp!: Date;
}
