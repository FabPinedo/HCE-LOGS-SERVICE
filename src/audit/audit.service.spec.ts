import { AuditService }          from './audit.service';
import { PayloadCryptoService }  from './payload-crypto.service';
import { IAuditEventHandler }    from './handlers/audit-event-handler.interface';
import { AuditEventData }        from './audit-event-data.interface';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** QueryRunner mínimo con manager y control de transacción */
function makeQr(saveFn = jest.fn().mockResolvedValue(undefined)) {
  return {
    connect:           jest.fn().mockResolvedValue(undefined),
    startTransaction:  jest.fn().mockResolvedValue(undefined),
    commitTransaction: jest.fn().mockResolvedValue(undefined),
    rollbackTransaction: jest.fn().mockResolvedValue(undefined),
    release:           jest.fn().mockResolvedValue(undefined),
    manager: { save: saveFn, upsert: jest.fn().mockResolvedValue(undefined) },
  };
}

function makeCrypto(returnValue = 'encrypted-payload'): jest.Mocked<PayloadCryptoService> {
  return { encrypt: jest.fn().mockReturnValue(returnValue) } as any;
}

function makeHandler(eventType: string, throwError = false): jest.Mocked<IAuditEventHandler> {
  return {
    eventType,
    handle: throwError
      ? jest.fn().mockRejectedValue(new Error(`${eventType} handler error`))
      : jest.fn().mockResolvedValue(undefined),
  } as any;
}

/** Repositorios mock mínimos para read-only queries */
function makeRepo() {
  return {
    find:    jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
  };
}

function makeDataSource(qr: ReturnType<typeof makeQr>) {
  return { createQueryRunner: jest.fn().mockReturnValue(qr) } as any;
}

function makeService(overrides: {
  handlers?: IAuditEventHandler[];
  crypto?:   jest.Mocked<PayloadCryptoService>;
  qr?:       ReturnType<typeof makeQr>;
} = {}) {
  const qr      = overrides.qr      ?? makeQr();
  const crypto  = overrides.crypto  ?? makeCrypto();
  const handlers = overrides.handlers ?? [];
  const ds      = makeDataSource(qr);
  const sessionRepo = makeRepo();
  const tokenRepo   = makeRepo();
  const eventRepo   = makeRepo();
  const traceRepo   = makeRepo();

  const svc = new AuditService(
    handlers,
    ds,
    crypto,
    sessionRepo as any,
    tokenRepo   as any,
    eventRepo   as any,
    traceRepo   as any,
  );
  return { svc, qr, crypto, ds, eventRepo, traceRepo, sessionRepo, tokenRepo };
}

const baseEvent: AuditEventData = {
  event_type:    'LOGIN_SUCCESS',
  user_id:       'u1',
  username:      'JPEREZ',
  action:        'login',
  outcome:       'success',
  source_system: 'mf-auth',
  ip_address:    '127.0.0.1',
  user_agent:    'jest',
  trace_id:      'trace-1',
  session_id:    'sess-1',
  payload:       { foo: 'bar' },
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('AuditService', () => {

  describe('processEvent()', () => {
    it('happy path — guarda AuditEvent y llama al handler correcto', async () => {
      const handler = makeHandler('LOGIN_SUCCESS');
      const { svc, qr, crypto } = makeService({ handlers: [handler] });

      await svc.processEvent(baseEvent);

      // crypto debe haber recibido el payload
      expect(crypto.encrypt).toHaveBeenCalledWith({ foo: 'bar' });

      // se debe haber guardado el AuditEvent
      expect(qr.manager.save).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          event_type:        'LOGIN_SUCCESS',
          username:          'JPEREZ',
          payload_encrypted: 'encrypted-payload',
        }),
      );

      // transacción completada
      expect(qr.startTransaction).toHaveBeenCalled();
      expect(qr.commitTransaction).toHaveBeenCalled();
      expect(qr.rollbackTransaction).not.toHaveBeenCalled();
      expect(qr.release).toHaveBeenCalled();

      // handler fue llamado
      expect(handler.handle).toHaveBeenCalledWith(baseEvent, qr);
    });

    it('event_type sin handler registrado → guarda evento y hace commit sin error', async () => {
      const { svc, qr } = makeService({ handlers: [] });
      await svc.processEvent({ ...baseEvent, event_type: 'UNKNOWN_TYPE' });
      expect(qr.commitTransaction).toHaveBeenCalled();
      expect(qr.rollbackTransaction).not.toHaveBeenCalled();
    });

    it('handler lanza error → rollback de la transacción', async () => {
      const handler = makeHandler('LOGIN_SUCCESS', true);
      const { svc, qr } = makeService({ handlers: [handler] });

      await svc.processEvent(baseEvent);   // no debe lanzar (error es capturado)

      expect(qr.rollbackTransaction).toHaveBeenCalled();
      expect(qr.commitTransaction).not.toHaveBeenCalled();
      expect(qr.release).toHaveBeenCalled();
    });

    it('save lanza error → rollback', async () => {
      const qr = makeQr(jest.fn().mockRejectedValue(new Error('DB error')));
      const { svc } = makeService({ qr });
      await svc.processEvent(baseEvent);
      expect(qr.rollbackTransaction).toHaveBeenCalled();
      expect(qr.commitTransaction).not.toHaveBeenCalled();
    });

    it('payload vacío → crypto.encrypt recibe {} y puede devolver undefined', async () => {
      // No usar makeCrypto(undefined) — en JS pasar undefined activa el default del parámetro.
      // Se construye el mock directamente para forzar el retorno de undefined.
      const crypto = { encrypt: jest.fn().mockReturnValue(undefined) } as any;
      const { svc, qr } = makeService({ crypto });
      await svc.processEvent({ ...baseEvent, payload: {} });
      expect(crypto.encrypt).toHaveBeenCalledWith({});
      expect(qr.manager.save).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ payload_encrypted: undefined }),
      );
    });

    it('event_type en minúsculas sigue encontrando el handler (toUpperCase)', async () => {
      const handler = makeHandler('LOGIN_SUCCESS');
      const { svc } = makeService({ handlers: [handler] });
      await svc.processEvent({ ...baseEvent, event_type: 'login_success' });
      expect(handler.handle).toHaveBeenCalled();
    });

    it('usa data.message como action cuando data.action es undefined', async () => {
      const { svc, qr } = makeService({ handlers: [] });
      const event = { ...baseEvent, action: undefined, message: 'fallback-action' };
      await svc.processEvent(event);
      expect(qr.manager.save).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ action: 'fallback-action' }),
      );
    });
  });

  describe('health()', () => {
    it('devuelve status UP con timestamp', () => {
      const { svc } = makeService();
      const result  = svc.health();
      expect(result.status).toBe('UP');
      expect(result.service).toBe('ms-lg-pruebas-kafka');
      expect(result.timestamp).toBeDefined();
    });
  });
});
