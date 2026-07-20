const { Pool } = require('pg');
const fs = require('fs');
const dns = require('dns');

// Node 18+ defaults to 'verbatim' DNS ordering, so the Supabase pooler
// hostname's AAAA record can be picked over its A record. Railway has no
// IPv6 egress, so that intermittently fails every new connection with
// ENETUNREACH. Force IPv4 first so pool connections are reachable.
dns.setDefaultResultOrder('ipv4first');

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
