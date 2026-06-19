const crypto = require('crypto');
const winston = require('winston');
const { get } = require('./requestContext');
const { getConfig } = require('../config/env');

/**
 * Dedicated AUDIT logger — separate from the application logger.
 *
 * Defence requirement: every security-relevant action (authentication,
 * authorization decisions, and data mutations) produces a structured audit
 * record that answers WHO did WHAT to WHICH resource, with WHAT result, from
 * WHERE, and WHEN — correlated by request id.
 *
 * TAMPER-EVIDENCE: records are linked into an HMAC-SHA256 hash chain. Each
 * record carries `seq`, `prevHash`, and `hash`, where
 *   hash = HMAC(key, prevHash + canonical(record-without-hash))
 * Because every hash commits to the previous one, editing, deleting, inserting,
 * or reordering any record breaks the chain from that point onward, and the key
 * is secret (never written to the log) so an attacker cannot recompute valid
 * hashes. Use `verifyChain()` (or `scripts/verify-audit.js`) to detect tampering.
 *
 * Each process emits its own chain (`chainId`, random per boot); a verifier
 * checks each chain independently. Hash-chaining detects mutation/reordering
 * within a chain; to also detect wholesale truncation of the tail, periodically
 * anchor the latest `hash` in an external/append-only store.
 */
const auditLogger = winston.createLogger({
  level: 'info',
  // We stamp our own ISO `timestamp` INSIDE the hashed record, so don't let
  // winston add a second one outside the chain.
  format: winston.format.json(),
  transports: [new winston.transports.Console()],
  // Audit is a hard requirement — never silence it, even under NODE_ENV=test
  // we keep it on so tests can assert audit emission.
});

const GENESIS = '0'.repeat(64);

// HMAC key for the chain. Prefer a dedicated AUDIT_HMAC_KEY; fall back to the
// (already-required-in-every-env) JWT access secret so the chain always has a
// secret key without introducing a new mandatory env var. Memoized after first
// use. The key is NEVER included in a record.
let hmacKey = null;
const getHmacKey = () => {
  if (!hmacKey) {
    const cfg = getConfig();
    hmacKey = cfg.auditHmacKey || cfg.jwtAccessSecret;
  }
  return hmacKey;
};

/**
 * Deterministic JSON serialization: object keys sorted recursively so the hash
 * is stable regardless of property insertion order. `undefined` → null.
 */
const canonical = (v) => {
  if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']';
  if (v && typeof v === 'object') {
    return (
      '{' +
      Object.keys(v)
        .sort()
        .map((k) => JSON.stringify(k) + ':' + canonical(v[k]))
        .join(',') +
      '}'
    );
  }
  return JSON.stringify(v === undefined ? null : v);
};

/** Compute the chain hash for a record that already has `prevHash` set. */
const computeHash = (recordWithoutHash, key) =>
  crypto
    .createHmac('sha256', key)
    .update(recordWithoutHash.prevHash + canonical(recordWithoutHash))
    .digest('hex');

// ── Per-process chain state ─────────────────────────────────
const chainId = crypto.randomUUID();
let seq = 0;
let lastHash = GENESIS;

/**
 * Emit an audit event (appends one link to the tamper-evident chain).
 *
 * @param {object} e
 * @param {string} e.action   - e.g. 'auth.login', 'task.delete', 'authz.deny'
 * @param {'SUCCESS'|'FAILURE'} e.result
 * @param {object} [e.actor]  - { id, role, email } of the acting principal
 * @param {object} [e.resource] - { type, id } the action targeted
 * @param {object} [e.context]   - request-derived context (ip, method, path)
 * @param {object} [e.metadata]  - any extra non-sensitive detail
 * @returns {object} the emitted record (including seq/prevHash/hash)
 */
const audit = ({ action, result, actor, resource, context, metadata }) => {
  const { requestId } = get();
  // Build the full record EXCEPT `hash`. Everything here is committed to by the
  // chain, so the verifier reconstructs this exact object (minus winston's
  // `level`/`message`) and recomputes the hash.
  const record = {
    category: 'AUDIT',
    timestamp: new Date().toISOString(),
    chainId,
    seq: seq++,
    action,
    result,
    actor: actor || null,
    resource: resource || null,
    requestId: requestId || null,
    ...context,
    ...(metadata ? { metadata } : {}),
    prevHash: lastHash,
  };
  record.hash = computeHash(record, getHmacKey());
  lastHash = record.hash;
  auditLogger.info('audit', record);
  return record;
};

/**
 * Verify a set of audit records form intact hash chains.
 *
 * @param {object[]} records - parsed audit objects (any order; `level`/`message`
 *                             winston fields are tolerated and ignored).
 * @param {string} key       - the HMAC key the records were signed with.
 * @returns {{ ok: boolean, chains: number, checked: number, errors: Array<{chainId,seq,reason}> }}
 */
const verifyChain = (records, key) => {
  const errors = [];
  // Group by chainId, then order by seq.
  const byChain = new Map();
  for (const r of records) {
    if (!r || r.category !== 'AUDIT') continue;
    if (!byChain.has(r.chainId)) byChain.set(r.chainId, []);
    byChain.get(r.chainId).push(r);
  }

  let checked = 0;
  for (const [cid, recs] of byChain) {
    recs.sort((a, b) => a.seq - b.seq);
    let expectedPrev = GENESIS;
    let expectedSeq = 0;
    for (const r of recs) {
      checked++;
      if (r.seq !== expectedSeq) {
        errors.push({ chainId: cid, seq: r.seq, reason: `missing/duplicate record (expected seq ${expectedSeq})` });
      }
      if (r.prevHash !== expectedPrev) {
        errors.push({ chainId: cid, seq: r.seq, reason: 'prevHash does not link to previous record' });
      }
      // Recompute over the record minus winston/transport-added fields.
      const { hash, level, message, ...rest } = r; // eslint-disable-line no-unused-vars
      const recomputed = computeHash(rest, key);
      if (recomputed !== hash) {
        errors.push({ chainId: cid, seq: r.seq, reason: 'hash mismatch — record was altered' });
      }
      expectedPrev = r.hash;
      expectedSeq = r.seq + 1;
    }
  }

  return { ok: errors.length === 0, chains: byChain.size, checked, errors };
};

/**
 * Convenience: derive audit context (ip / method / path) from an Express
 * request without leaking bodies or secrets.
 */
const fromRequest = (req) => ({
  ip: req.ip,
  method: req.method,
  path: req.originalUrl,
  userAgent: req.get && req.get('user-agent'),
});

module.exports = { audit, fromRequest, auditLogger, verifyChain, canonical, GENESIS };
