#!/usr/bin/env node
/**
 * Verify the integrity of a tamper-evident audit log.
 *
 * Reads newline-delimited JSON audit records (the `category:"AUDIT"` lines
 * emitted by src/utils/audit.js) from a file or STDIN, then checks that each
 * per-process hash chain is intact: correct sequence, linked prevHash, and a
 * matching HMAC. Exits 0 if every chain verifies, 1 if any tampering is found.
 *
 * Usage:
 *   node scripts/verify-audit.js audit.log
 *   kubectl logs -n taskflow-cap -l app=tasks-service | node scripts/verify-audit.js
 *
 * Key resolution mirrors the app: AUDIT_HMAC_KEY, else JWT_ACCESS_SECRET.
 */
const fs = require('fs');
const { verifyChain } = require('../src/utils/audit');

const key = process.env.AUDIT_HMAC_KEY || process.env.JWT_ACCESS_SECRET;
if (!key) {
  console.error('error: set AUDIT_HMAC_KEY or JWT_ACCESS_SECRET (the key the log was signed with)');
  process.exit(2);
}

const readInput = () => {
  const file = process.argv[2];
  if (file) return fs.readFileSync(file, 'utf8');
  return fs.readFileSync(0, 'utf8'); // STDIN
};

const records = [];
for (const line of readInput().split('\n')) {
  const trimmed = line.trim();
  if (!trimmed) continue;
  try {
    const obj = JSON.parse(trimmed);
    if (obj && obj.category === 'AUDIT') records.push(obj);
  } catch {
    // Non-JSON line (e.g. interleaved app log) — ignore.
  }
}

if (records.length === 0) {
  console.error('error: no AUDIT records found on input');
  process.exit(2);
}

const result = verifyChain(records, key);
if (result.ok) {
  console.log(`OK — ${result.checked} audit record(s) across ${result.chains} chain(s) verified intact.`);
  process.exit(0);
}

console.error(`TAMPER DETECTED — ${result.errors.length} problem(s) across ${result.chains} chain(s):`);
for (const e of result.errors) {
  console.error(`  chain ${e.chainId} seq ${e.seq}: ${e.reason}`);
}
process.exit(1);
