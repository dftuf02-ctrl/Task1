const { audit, verifyChain, canonical } = require('../../src/utils/audit');

// NODE_ENV=test => audit falls back to the test JWT access secret as the HMAC key.
const KEY = process.env.JWT_ACCESS_SECRET || 'test-only-access-secret';

describe('audit hash-chain (tamper-evidence)', () => {
  let logSpy;
  const emitted = [];

  beforeAll(() => {
    // audit() writes via winston Console transport to stdout as JSON; capture it.
    logSpy = jest.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      try {
        const obj = JSON.parse(chunk.toString());
        if (obj.category === 'AUDIT') emitted.push(obj);
      } catch {
        /* ignore non-JSON */
      }
      return true;
    });
  });

  afterAll(() => logSpy.mockRestore());

  it('emits linked records that verify as an intact chain', () => {
    audit({ action: 'auth.login', result: 'SUCCESS', actor: { id: 'u1', role: 'USER' } });
    audit({ action: 'task.create', result: 'SUCCESS', actor: { id: 'u1' }, resource: { type: 'task', id: 't1' } });
    audit({ action: 'task.delete', result: 'SUCCESS', actor: { id: 'u1' }, resource: { type: 'task', id: 't1' } });

    expect(emitted.length).toBeGreaterThanOrEqual(3);

    const result = verifyChain(emitted, KEY);
    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.checked).toBe(emitted.length);
  });

  it('detects a mutated record (altered field)', () => {
    const tampered = emitted.map((r) => ({ ...r }));
    // Attacker rewrites a delete to look like it never happened.
    tampered[2].action = 'task.read';

    const result = verifyChain(tampered, KEY);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.reason.includes('hash mismatch'))).toBe(true);
  });

  it('detects a deleted record (broken link)', () => {
    const withHole = [emitted[0], emitted[2]]; // drop the middle record

    const result = verifyChain(withHole, KEY);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => /prevHash|missing/.test(e.reason))).toBe(true);
  });

  it('detects verification under the wrong key (forged/re-signed)', () => {
    const result = verifyChain(emitted, 'wrong-key');
    expect(result.ok).toBe(false);
  });

  it('canonical() is order-independent', () => {
    expect(canonical({ a: 1, b: 2 })).toBe(canonical({ b: 2, a: 1 }));
    expect(canonical({ a: 1 })).not.toBe(canonical({ a: 2 }));
  });
});
