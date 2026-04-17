import { LoginSuccessHandler } from './login-success.handler';
import { AuditEventData }      from '../audit-event-data.interface';

// ── Helper ────────────────────────────────────────────────────────────────────

function makeQr() {
  return {
    manager: {
      upsert: jest.fn().mockResolvedValue(undefined),
    },
  } as any;
}

const baseData: AuditEventData = {
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
  payload:       {},
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('LoginSuccessHandler', () => {

  it('eventType es LOGIN_SUCCESS', () => {
    expect(new LoginSuccessHandler().eventType).toBe('LOGIN_SUCCESS');
  });

  describe('handle()', () => {
    it('hace upsert de UserEntity y AuthSession cuando user_id, username y session_id están presentes', async () => {
      const handler = new LoginSuccessHandler();
      const qr      = makeQr();

      await handler.handle(baseData, qr);

      expect(qr.manager.upsert).toHaveBeenCalledTimes(2);

      // Primer upsert → UserEntity
      expect(qr.manager.upsert).toHaveBeenNthCalledWith(
        1,
        expect.anything(),   // UserEntity class
        { user_id: 'u1', username: 'JPEREZ', status: 'active' },
        ['user_id'],
      );

      // Segundo upsert → AuthSession
      expect(qr.manager.upsert).toHaveBeenNthCalledWith(
        2,
        expect.anything(),   // AuthSession class
        { session_id: 'sess-1', user_id: 'u1', status: 'active' },
        ['session_id'],
      );
    });

    it('sin user_id → omite upsert de UserEntity', async () => {
      const handler = new LoginSuccessHandler();
      const qr      = makeQr();

      await handler.handle({ ...baseData, user_id: undefined, username: 'JPEREZ' }, qr);

      // Solo se llama para AuthSession (session_id sí está)
      expect(qr.manager.upsert).toHaveBeenCalledTimes(1);
      expect(qr.manager.upsert).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ session_id: 'sess-1' }),
        ['session_id'],
      );
    });

    it('sin username → omite upsert de UserEntity', async () => {
      const handler = new LoginSuccessHandler();
      const qr      = makeQr();

      await handler.handle({ ...baseData, username: undefined }, qr);

      expect(qr.manager.upsert).toHaveBeenCalledTimes(1);
      expect(qr.manager.upsert).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ session_id: 'sess-1' }),
        ['session_id'],
      );
    });

    it('sin session_id → omite upsert de AuthSession', async () => {
      const handler = new LoginSuccessHandler();
      const qr      = makeQr();

      await handler.handle({ ...baseData, session_id: undefined }, qr);

      // Solo se llama para UserEntity
      expect(qr.manager.upsert).toHaveBeenCalledTimes(1);
      expect(qr.manager.upsert).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ user_id: 'u1', username: 'JPEREZ' }),
        ['user_id'],
      );
    });

    it('sin user_id ni session_id → no llama a upsert', async () => {
      const handler = new LoginSuccessHandler();
      const qr      = makeQr();

      await handler.handle({ ...baseData, user_id: undefined, username: undefined, session_id: undefined }, qr);

      expect(qr.manager.upsert).not.toHaveBeenCalled();
    });

    it('session_id sin user_id usa "unknown" como user_id en AuthSession', async () => {
      const handler = new LoginSuccessHandler();
      const qr      = makeQr();

      await handler.handle({ ...baseData, user_id: undefined, username: undefined }, qr);

      expect(qr.manager.upsert).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ session_id: 'sess-1', user_id: 'unknown' }),
        ['session_id'],
      );
    });
  });
});
