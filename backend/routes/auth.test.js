const assert = require('node:assert/strict');
const http = require('node:http');
const test = require('node:test');
const express = require('express');
const bcrypt = require('bcryptjs');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

async function request(app, method, path, body) {
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  try {
    const response = await fetch(`http://127.0.0.1:${port}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return {
      status: response.status,
      body: await response.json(),
    };
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

test('login normalizes email before looking up the user', async () => {
  const storedEmail = 'admin@example.com';
  const passwordHash = await bcrypt.hash('correct-password', 4);

  const dbPath = require.resolve('../db');
  const authPath = require.resolve('./auth');
  delete require.cache[authPath];
  require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: {
      query: async (sql, params) => {
        assert.match(sql, /LOWER\(u\.email\) = \$1/);
        assert.equal(params[0], storedEmail);
        return {
          rows: [{
            id: 'user-1',
            email: storedEmail,
            password_hash: passwordHash,
            role: 'admin',
            tenant_id: 'tenant-1',
            tenant_name: 'Test Laundry',
            permissions: '[]',
          }],
        };
      },
    },
  };

  const app = express();
  app.use(express.json());
  app.use('/auth', require('./auth'));

  const response = await request(app, 'POST', '/auth/login', {
    email: ' Admin@Example.com ',
    password: 'correct-password',
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.email, storedEmail);
  assert.equal(response.body.role, 'admin');
  assert.ok(response.body.token);

  delete require.cache[authPath];
  delete require.cache[dbPath];
});

test('signup rejects a shop name that already exists under another email', async () => {
  const dbPath = require.resolve('../db');
  const authPath = require.resolve('./auth');
  delete require.cache[authPath];
  const queries = [];
  const client = {
    query: async (sql, params) => {
      queries.push(sql);
      if (/lower\(regexp_replace\(name/.test(sql)) {
        assert.equal(params[0], 'labaday');
        return { rows: [{ '?column?': 1 }] };
      }
      return { rows: [] };
    },
    release() {},
  };
  require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: { query: async () => ({ rows: [] }), pool: { connect: async () => client } },
  };

  const app = express();
  app.use(express.json());
  app.use('/auth', require('./auth'));

  const response = await request(app, 'POST', '/auth/signup', {
    business_name: 'Laba-Day ',
    email: 'second@gmail.com',
    password: 'longenough1',
    phone: '0917 123 4567',
  });

  assert.equal(response.status, 409);
  assert.match(response.body.error, /shop with this name already exists/);
  assert.ok(!queries.some(q => /INSERT INTO tenants/.test(q)), 'must not create a tenant');
  assert.ok(queries.includes('ROLLBACK'));

  delete require.cache[authPath];
  delete require.cache[dbPath];
});

function loadSignupApp(clientQuery) {
  const dbPath = require.resolve('../db');
  const authPath = require.resolve('./auth');
  delete require.cache[authPath];
  const client = { query: clientQuery, release() {} };
  require.cache[dbPath] = {
    id: dbPath, filename: dbPath, loaded: true,
    exports: { query: async () => ({ rows: [] }), pool: { connect: async () => client } },
  };
  const app = express();
  app.use(express.json());
  app.use('/auth', require('./auth'));
  return { app, cleanup() { delete require.cache[authPath]; delete require.cache[dbPath]; } };
}

test('signup requires a valid Philippine mobile number and a facebook.com Page link', async () => {
  const { app, cleanup } = loadSignupApp(async () => ({ rows: [] }));
  const base = { business_name: 'Fresh Wash', email: 'owner@gmail.com', password: 'longenough1' };

  let r = await request(app, 'POST', '/auth/signup', base);
  assert.equal(r.status, 400);
  assert.match(r.body.error, /mobile number/);

  r = await request(app, 'POST', '/auth/signup', { ...base, phone: '12345' });
  assert.equal(r.status, 400);

  r = await request(app, 'POST', '/auth/signup', { ...base, phone: '09171234567', facebook_page: 'https://evil.example/x' });
  assert.equal(r.status, 400);
  assert.match(r.body.error, /Facebook Page link/);
  cleanup();
});

test('signup rejects an owner phone that already has a trial and normalizes +63 numbers', async () => {
  const queries = [];
  const { app, cleanup } = loadSignupApp(async (sql, params) => {
    queries.push(sql);
    if (/owner_phone = \$1/.test(sql)) {
      assert.equal(params[0], '09171234567');
      return { rows: [{ '?column?': 1 }] };
    }
    return { rows: [] };
  });
  const r = await request(app, 'POST', '/auth/signup', {
    business_name: 'Fresh Wash', email: 'owner@gmail.com', password: 'longenough1',
    phone: '+63 917-123-4567',
  });
  assert.equal(r.status, 409);
  assert.match(r.body.error, /mobile number already exists/);
  assert.ok(!queries.some(q => /INSERT INTO tenants/.test(q)), 'must not create a tenant');
  cleanup();
});
