import { PayloadCryptoService } from './payload-crypto.service';
import { ConfigService }        from '@nestjs/config';

// AES-256-GCM requiere exactamente 32 bytes
const VALID_KEY = '12345678901234567890123456789012';  // 32 chars ASCII

function makeCfg(key = '', nodeEnv = 'test'): ConfigService {
  const map: Record<string, string> = {
    AUDIT_PAYLOAD_KEY: key,
    NODE_ENV:          nodeEnv,
  };
  return { get: (k: string, d = '') => map[k] ?? d } as any;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('PayloadCryptoService', () => {

  describe('sin key (modo plano)', () => {
    it('encrypt devuelve JSON plano cuando no hay AUDIT_PAYLOAD_KEY', () => {
      const svc    = new PayloadCryptoService(makeCfg(''));
      const result = svc.encrypt({ action: 'login', userId: 'u1' });
      expect(result).toBe(JSON.stringify({ action: 'login', userId: 'u1' }));
    });

    it('encrypt devuelve undefined para objeto vacío', () => {
      const svc = new PayloadCryptoService(makeCfg(''));
      expect(svc.encrypt({})).toBeUndefined();
    });

    it('decrypt parsea JSON plano correctamente', () => {
      const svc    = new PayloadCryptoService(makeCfg(''));
      const stored = JSON.stringify({ x: 1 });
      expect(svc.decrypt(stored)).toEqual({ x: 1 });
    });

    it('decrypt devuelve null para string vacío', () => {
      const svc = new PayloadCryptoService(makeCfg(''));
      expect(svc.decrypt('')).toBeNull();
    });

    it('decrypt devuelve null para JSON inválido', () => {
      const svc = new PayloadCryptoService(makeCfg(''));
      expect(svc.decrypt('no-es-json')).toBeNull();
    });
  });

  describe('con key válida (cifrado AES-256-GCM)', () => {
    it('encrypt produce un string con formato base64.base64.base64', () => {
      const svc    = new PayloadCryptoService(makeCfg(VALID_KEY));
      const result = svc.encrypt({ a: 1 });
      expect(result).toBeDefined();
      const parts = result!.split('.');
      expect(parts).toHaveLength(3);
      // cada parte es base64 válido (no lanza error al decodificar)
      expect(() => Buffer.from(parts[0], 'base64')).not.toThrow();
      expect(() => Buffer.from(parts[1], 'base64')).not.toThrow();
      expect(() => Buffer.from(parts[2], 'base64')).not.toThrow();
    });

    it('round-trip: decrypt(encrypt(data)) devuelve el objeto original', () => {
      const svc  = new PayloadCryptoService(makeCfg(VALID_KEY));
      const data = { action: 'login', userId: 'u99', nested: { ok: true } };
      const enc  = svc.encrypt(data)!;
      expect(svc.decrypt(enc)).toEqual(data);
    });

    it('dos llamadas a encrypt producen ciphertexts distintos (IV aleatorio)', () => {
      const svc = new PayloadCryptoService(makeCfg(VALID_KEY));
      const a   = svc.encrypt({ x: 1 });
      const b   = svc.encrypt({ x: 1 });
      expect(a).not.toBe(b);
    });

    it('encrypt devuelve undefined para objeto vacío (con key)', () => {
      const svc = new PayloadCryptoService(makeCfg(VALID_KEY));
      expect(svc.encrypt({})).toBeUndefined();
    });

    it('decrypt devuelve null si el ciphertext está corrompido', () => {
      const svc = new PayloadCryptoService(makeCfg(VALID_KEY));
      // IV y tag válidos pero ciphertext basura
      const fakeIv  = Buffer.alloc(12).toString('base64');
      const fakeTag = Buffer.alloc(16).toString('base64');
      const corrupt = `${fakeIv}.${fakeTag}.AAAAAA==`;
      expect(svc.decrypt(corrupt)).toBeNull();
    });

    it('decrypt devuelve null si el string no tiene 3 partes', () => {
      const svc = new PayloadCryptoService(makeCfg(VALID_KEY));
      expect(svc.decrypt('solo.dos')).toBeNull();
    });
  });

  describe('key con longitud incorrecta', () => {
    it('cae a modo plano si la key no tiene 32 bytes', () => {
      const svc    = new PayloadCryptoService(makeCfg('corta'));
      const result = svc.encrypt({ x: 1 });
      // sin key → plano
      expect(result).toBe(JSON.stringify({ x: 1 }));
    });
  });
});
