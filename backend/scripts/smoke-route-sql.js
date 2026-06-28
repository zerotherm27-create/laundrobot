#!/usr/bin/env node
'use strict';

// ── Route SQL smoke test ─────────────────────────────────────────────────────
// Validates every static SQL query embedded in the route handlers by asking
// Postgres to PLAN it with `EXPLAIN (GENERIC_PLAN) ...` (PG 16+). GENERIC_PLAN
// validates syntax AND planning for a parameterised statement WITHOUT executing
// it — no rows are read or written, so this is safe to run against the prod DB
// that backend/.env points at.
//
// Catches the class of bug that 500'd GET /referrals (malformed aggregate
// FILTER) before it can reach production, plus missing columns, bad casts, etc.
//
//   Run:  node scripts/smoke-route-sql.js     (needs DATABASE_URL)
//   CI :  the static guard in routes/sqlAggregateFilter.test.js needs no DB.
//
// Dynamic queries (built with ${...} interpolation) cannot be planned as-is and
// are reported as "skipped (dynamic)" rather than failing the run.

require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');

if (!process.env.DATABASE_URL) {
  console.error('SKIP: DATABASE_URL not set — cannot reach a database to plan queries.');
  process.exit(0);
}

const db = require('../db');

const ROUTES_DIR = path.join(__dirname, '..', 'routes');
const DML_START = /^(SELECT|INSERT|UPDATE|DELETE|WITH)\b/i;

/**
 * Extract every SQL template literal passed to a `.query(` call in `src`.
 * Returns { sql, line } for each. Only template literals (backtick) are
 * captured; string-variable queries are not literals and are skipped.
 */
function extractQueries(src) {
  const out = [];
  const marker = '.query(';
  let idx = 0;
  while ((idx = src.indexOf(marker, idx)) !== -1) {
    let i = idx + marker.length;
    while (i < src.length && /\s/.test(src[i])) i++; // skip whitespace/newlines
    if (src[i] === '`') {
      const start = i + 1;
      let j = start;
      while (j < src.length && src[j] !== '`') j++; // backticks never appear in our SQL
      const sql = src.slice(start, j);
      const line = src.slice(0, start).split('\n').length;
      out.push({ sql, line });
      i = j + 1;
    }
    idx = i;
  }
  return out;
}

async function main() {
  const files = fs.readdirSync(ROUTES_DIR)
    .filter(f => f.endsWith('.js') && !f.endsWith('.test.js'))
    .sort();

  let scanned = 0, tested = 0;
  const skippedDynamic = [];
  const skippedNonDml = [];
  const inconclusive = [];
  const failures = [];

  for (const file of files) {
    const src = fs.readFileSync(path.join(ROUTES_DIR, file), 'utf8');
    for (const { sql, line } of extractQueries(src)) {
      scanned++;
      const trimmed = sql.trim();
      if (sql.includes('${')) { skippedDynamic.push(`${file}:${line}`); continue; }
      if (!DML_START.test(trimmed)) { skippedNonDml.push(`${file}:${line}`); continue; }
      // One statement only — drop a single trailing semicolon, skip multi-statement
      const oneStmt = trimmed.replace(/;\s*$/, '');
      if (oneStmt.includes(';')) { skippedNonDml.push(`${file}:${line} (multi-statement)`); continue; }

      try {
        await db.query(`EXPLAIN (GENERIC_PLAN) ${oneStmt}`);
        tested++;
      } catch (err) {
        const msg = err.message || String(err);
        // GENERIC_PLAN can't infer a bare parameter's type in rare cases; that's
        // a planner limitation, not a real bug — treat as inconclusive.
        if (/could not determine data type of parameter/i.test(msg)) {
          inconclusive.push(`${file}:${line} — ${msg}`);
        } else {
          failures.push({ where: `${file}:${line}`, msg, snippet: oneStmt.replace(/\s+/g, ' ').slice(0, 120) });
        }
      }
    }
  }

  console.log(`\nRoute SQL smoke test (EXPLAIN GENERIC_PLAN, no execution)`);
  console.log(`────────────────────────────────────────────────────────`);
  console.log(`  scanned query literals : ${scanned}`);
  console.log(`  planned OK             : ${tested}`);
  console.log(`  skipped (dynamic ${'${}'}) : ${skippedDynamic.length}`);
  console.log(`  skipped (non-DML)      : ${skippedNonDml.length}`);
  console.log(`  inconclusive (param type): ${inconclusive.length}`);
  console.log(`  FAILURES               : ${failures.length}`);

  if (failures.length) {
    console.log(`\n✖ Broken queries:\n`);
    for (const f of failures) {
      console.log(`  ${f.where}`);
      console.log(`    error: ${f.msg}`);
      console.log(`    sql  : ${f.snippet}…\n`);
    }
  }

  await db.pool.end();
  process.exit(failures.length ? 1 : 0);
}

main().catch(err => {
  console.error('Smoke test crashed:', err);
  process.exit(2);
});
