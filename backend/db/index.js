const { Pool } = require('pg');
const fs = require('fs');
const dns = require('dns');

// Railway resolves the Supabase pooler hostname to an AAAA (IPv6) address
// that Railway's network cannot route, so every fresh pg connection failed
// with ENETUNREACH. dns.setDefaultResultOrder('ipv4first') alone did not
// fix this (Node's Happy Eyeballs / autoSelectFamily, on by default since
// Node 20, still raced the IPv6 candidate) — force every dns.lookup() in
// the process to request A records only, so no IPv6 candidate ever exists
// to race or connect to. pg opens its socket via plain net.Socket#connect
// (no family option), so this global override is the only hook available.
const systemLookup = dns.lookup;
dns.lookup = (hostname, options, callback) => {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  } else if (typeof options === 'number') {
    options = { family: options };
  }
  return systemLookup(hostname, { ...options, family: 4 }, callback);
};

function buildSslConfig() {
  const rejectUnauthorized = process.env.PGSSL_REJECT_UNAUTHORIZED === 'true';
  const inlineCa = process.env.PGSSLROOTCERT || process.env.PG_CA_CERT;
  const caFile = process.env.PGSSLROOTCERT_FILE || process.env.PG_CA_CERT_FILE;

  if (caFile) {
    return {
      rejectUnauthorized: true,
      ca: fs.readFileSync(caFile, 'utf8'),
    };
  }

  if (inlineCa) {
    return {
      rejectUnauthorized: true,
      ca: inlineCa.replace(/\\n/g, '\n'),
    };
  }

  if (rejectUnauthorized) return { rejectUnauthorized: true };

  console.warn('[db] PG CA certificate not configured; SSL is enabled without certificate verification.');
  return { rejectUnauthorized: false };
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: buildSslConfig(),
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
  max: 10,
});

pool.connect((err, client, release) => {
  if (err) {
    console.error('Database connection error:', err.message);
  } else {
    console.log('Connected to Supabase database');
    release();
  }
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
