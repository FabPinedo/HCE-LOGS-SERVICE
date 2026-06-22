import { AuditUseCase }        from './Audit.use-case';
import { IAuditEventHandler }  from '../../domain/handlers/audit-event-handler.interface';
import { AuditRepository }     from '../../domain/repositories/audit.repository';
import { AuditEventData }      from '../../domain/models/audit-event-data.interface';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** QueryRunner mínimo con manager y control de transacción */
function makeQr() {
  return {
    connect:             jest.fn().mockResolvedValue(undefined),
    startTransaction:    jest.fn().mockResolvedValue(undefined),
    commitTransaction:   jest.fn().mockResolvedValue(undefined),
    rollbackTransaction: jest.fn().mockResolvedValue(undefined),
    release:             jest.fn().mockResolvedValue(undefined),
    manager: { save: jest.fn(), upsert: jest.fn() },
  };
}

function makeRepository(overrides: { saveAuditEvent?: jest.Mock } = {}): jest.Mocked<AuditRepository> {
  return {
    saveAuditEvent: overrides.saveAuditEvent ?? jest.fn().mockResolvedValue(undefined),
    findEvents:     jest.fn().mockResolvedValue([]),
    findTrace:      jest.fn().mockResolvedValue({ trace: null, events: [] }),
    findSession:    jest.fn().mockResolvedValue({ session: null, events: [], tokens: [] }),
  } as any;
}

function makeHandler(eventType: string, throwError = false): jest.Mocked<IAuditEventHandler> {
  return {
    eventType,
    handle: throwError
      ? jest.fn().mockRejectedValue(new Error(`${eventType} handler error`))
      : jest.fn().mockResolvedValue(undefined),
  } as any;
}

function makeDataSource(qr: ReturnType<typeof makeQr>) {
  return { createQueryRunner: jest.fn().mockReturnValue(qr) } as any;
}

function makeUseCase(overrides: {
  handlers?:   IAuditEventHandler[];
  repository?: jest.Mocked<AuditRepository>;
  qr?:         ReturnType<typeof makeQr>;
} = {}) {
  const qr         = overrides.qr ?? makeQr();
  const repository = overrides.repository ?? makeRepository();
  const handlers    = overrides.handlers ?? [];
  const ds          = makeDataSource(qr);

  const useCase = new AuditUseCase(handlers, ds, repository);
  return { useCase, qr, repository, ds };
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

describe('AuditUseCase', () => {

  describe('processEvent()', () => {
    it('happy path — guarda el evento vía repository y llama al handler correcto', async () => {
      const handler = makeHandler('LOGIN_SUCCESS');
      const { useCase, qr, repository } = makeUseCase({ handlers: [handler] });

      await useCase.processEvent(baseEvent);

      expect(repository.saveAuditEvent).toHaveBeenCalledWith(baseEvent, qr);
      expect(handler.handle).toHaveBeenCalledWith(baseEvent, qr);

      expect(qr.startTransaction).toHaveBeenCalled();
      expect(qr.commitTransaction).toHaveBeenCalled();
      expect(qr.rollbackTransaction).not.toHaveBeenCalled();
      expect(qr.release).toHaveBeenCalled();
    });

    it('event_type sin handler registrado → guarda evento y hace commit sin error', async () => {
      const { useCase, qr } = makeUseCase({ handlers: [] });
      await useCase.processEvent({ ...baseEvent, event_type: 'UNKNOWN_TYPE' });
      expect(qr.commitTransaction).toHaveBeenCalled();
      expect(qr.rollbackTransaction).not.toHaveBeenCalled();
    });

    it('handler lanza error → rollback de la transacción', async () => {
      const handler = makeHandler('LOGIN_SUCCESS', true);
      const { useCase, qr } = makeUseCase({ handlers: [handler] });

      await useCase.processEvent(baseEvent);   // no debe lanzar (error es capturado)

      expect(qr.rollbackTransaction).toHaveBeenCalled();
      expect(qr.commitTransaction).not.toHaveBeenCalled();
      expect(qr.release).toHaveBeenCalled();
    });

    it('repository.saveAuditEvent lanza error → rollback', async () => {
      const repository = makeRepository({ saveAuditEvent: jest.fn().mockRejectedValue(new Error('DB error')) });
      const { useCase, qr } = makeUseCase({ repository });
      await useCase.processEvent(baseEvent);
      expect(qr.rollbackTransaction).toHaveBeenCalled();
      expect(qr.commitTransaction).not.toHaveBeenCalled();
    });

    it('event_type en minúsculas sigue encontrando el handler (toUpperCase)', async () => {
      const handler = makeHandler('LOGIN_SUCCESS');
      const { useCase } = makeUseCase({ handlers: [handler] });
      await useCase.processEvent({ ...baseEvent, event_type: 'login_success' });
      expect(handler.handle).toHaveBeenCalled();
    });
  });

  describe('findEvents() / findTrace() / findSession()', () => {
    it('delegan al repository', async () => {
      const repository = makeRepository();
      const { useCase } = makeUseCase({ repository });

      await useCase.findEvents({ username: 'JPEREZ' });
      expect(repository.findEvents).toHaveBeenCalledWith({ username: 'JPEREZ' });

      await useCase.findTrace('trace-1');
      expect(repository.findTrace).toHaveBeenCalledWith('trace-1');

      await useCase.findSession('sess-1');
      expect(repository.findSession).toHaveBeenCalledWith('sess-1');
    });
  });

  describe('health()', () => {
    it('devuelve status UP con timestamp', () => {
      const { useCase } = makeUseCase();
      const result = useCase.health();
      expect(result.status).toBe('UP');
      expect(result.service).toBe('ms-lg-pruebas-kafka');
      expect(result.timestamp).toBeDefined();
    });
  });
});
