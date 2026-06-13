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
