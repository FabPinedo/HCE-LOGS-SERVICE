import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGO       = 'aes-256-gcm';
const IV_BYTES   = 12;   // GCM recomendado: 12 bytes
const TAG_BYTES  = 16;   // auth tag GCM: 16 bytes
const KEY_BYTES  = 32;   // AES-256: 32 bytes

/**
 * S5 — Cifrado AES-256-GCM del payload de auditoría antes de persistir.
 *
 * Formato almacenado en payload_encrypted:
 *   base64(iv).base64(authTag).base64(ciphertext)
 *
 * Si AUDIT_PAYLOAD_KEY no está configurado, almacena JSON plano
 * (permisivo en desarrollo, en producción SIEMPRE configurar la key).
 *
 * Ventaja de GCM sobre CBC: incluye autenticación — detecta
 * manipulación del ciphertext sin necesidad de HMAC adicional.
 */
@Injectable()
export class PayloadCryptoService {
  private readonly logger = new Logger(PayloadCryptoService.name);
  private readonly key:   Buffer | null;

  constructor(cfg: ConfigService) {
    const raw = cfg.get<string>('AUDIT_PAYLOAD_KEY', '');
    if (!raw) {
      this.key = null;
      if (cfg.get('NODE_ENV') === 'production') {
        this.logger.warn('AUDIT_PAYLOAD_KEY no configurado — payload_encrypted se guarda en texto plano');
      }
      return;
    }
    if (Buffer.byteLength(raw, 'utf8') !== KEY_BYTES) {
      this.logger.error(`AUDIT_PAYLOAD_KEY debe tener exactamente ${KEY_BYTES} bytes UTF-8 (actual: ${Buffer.byteLength(raw, 'utf8')})`);
      this.key = null;
      return;
    }
    this.key = Buffer.from(raw, 'utf8');
  }

  /**
   * Cifra un objeto y devuelve la cadena para persistir.
   * Devuelve undefined si el objeto está vacío.
   * Si no hay key, devuelve JSON plano.
   */
  encrypt(data: Record<string, any>): string | undefined {
    if (!data || Object.keys(data).length === 0) return undefined;
    const plain = JSON.stringify(data);

    if (!this.key) return plain;   // sin key → plano

    const iv     = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGO, this.key, iv);
    const enc    = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag    = cipher.getAuthTag();

    return `${iv.toString('base64')}.${tag.toString('base64')}.${enc.toString('base64')}`;
  }

  /**
   * Descifra una cadena almacenada con encrypt().
   * Si no tiene el formato esperado, intenta parsear como JSON plano.
   */
  decrypt(stored: string): Record<string, any> | null {
    if (!stored) return null;

    if (!this.key || !stored.includes('.')) {
      try { return JSON.parse(stored); } catch { return null; }
    }

    const parts = stored.split('.');
    if (parts.length !== 3) {
      try { return JSON.parse(stored); } catch { return null; }
    }

    try {
      const iv         = Buffer.from(parts[0], 'base64');
      const tag        = Buffer.from(parts[1], 'base64');
      const ciphertext = Buffer.from(parts[2], 'base64');
      const decipher   = createDecipheriv(ALGO, this.key, iv);
      decipher.setAuthTag(tag);
      const plain = decipher.update(ciphertext) + decipher.final('utf8');
      return JSON.parse(plain);
    } catch {
      this.logger.warn('Error al descifrar payload_encrypted — posible corrupción o key incorrecta');
      return null;
    }
  }
}
