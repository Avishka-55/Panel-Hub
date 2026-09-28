const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const http = require('http');

// Set environment before loading modules
process.env.NODE_ENV = 'test';
process.env.MASTER_KEY = crypto.randomBytes(32).toString('hex');
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/panelhub_test';
process.env.JWT_SECRET = 'test-jwt-secret-key';

const app = require('../src/app');
const { connectDB, disconnectDB } = require('../src/config/db');
const User = require('../src/models/User');
const Server = require('../src/models/Server');
const { createMock3xUiServer } = require('../src/services/mockPanelServer');

let mockPanel;
let server;
let baseUrl;

// Helper to make HTTP requests to the test express server
function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch (_) {
          json = data;
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: json
        });
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

test.before(async () => {
  await connectDB();
  await User.deleteMany({});
  await Server.deleteMany({});

  mockPanel = await createMock3xUiServer(0, 'admin', 'password123');

  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

test.after(async () => {
  if (server) {
    await new Promise((res) => server.close(res));
  }
  if (mockPanel) {
    await mockPanel.close();
  }
  await User.deleteMany({});
  await Server.deleteMany({});
  await disconnectDB();
});

let userTokenA = '';
let userTokenB = '';
let userAId = '';
let serverAId = '';

test('Auth: Register User A and User B with OTP verification', async () => {
  const resA = await request('POST', '/api/auth/register', {
    email: 'admin-a@saas.com',
    password: 'passwordA123'
  });

  assert.equal(resA.status, 201);
  assert.equal(resA.body.requiresVerification, true);
  assert.equal(resA.body.email, 'admin-a@saas.com');

  // Verify OTP for User A
  const userADoc = await User.findOne({ email: 'admin-a@saas.com' }).select('+verificationOtp +verificationOtpExpires');
  assert.ok(userADoc.verificationOtp);

  // Test invalid OTP rejection
  const badOtpRes = await request('POST', '/api/auth/verify-otp', {
    email: 'admin-a@saas.com',
    otp: '000000'
  });
  assert.equal(badOtpRes.status, 400);

  // Generate fresh valid OTP on doc to verify endpoint
  const validOtp = userADoc.createVerificationOtp();
  await userADoc.save();

  const verifyRes = await request('POST', '/api/auth/verify-otp', {
    email: 'admin-a@saas.com',
    otp: validOtp
  });

  assert.equal(verifyRes.status, 200);
  assert.ok(verifyRes.body.token);
  assert.equal(verifyRes.body.user.email, 'admin-a@saas.com');
  assert.equal(verifyRes.body.user.isVerified, true);
  assert.equal(verifyRes.body.user.passwordHash, undefined, 'passwordHash must never be exposed');

  userTokenA = verifyRes.body.token;
  userAId = verifyRes.body.user.id;

  // Register and verify User B
  await request('POST', '/api/auth/register', {
    email: 'admin-b@saas.com',
    password: 'passwordB123'
  });
  const userBDoc = await User.findOne({ email: 'admin-b@saas.com' });
  const otpB = userBDoc.createVerificationOtp();
  await userBDoc.save();

  const verifyB = await request('POST', '/api/auth/verify-otp', {
    email: 'admin-b@saas.com',
    otp: otpB
  });
  assert.equal(verifyB.status, 200);
  userTokenB = verifyB.body.token;
});

test('Auth: Login User A', async () => {
  const res = await request('POST', '/api/auth/login', {
    email: 'admin-a@saas.com',
    password: 'passwordA123'
  });

  assert.equal(res.status, 200);
  assert.ok(res.body.token);
  assert.equal(res.body.user.email, 'admin-a@saas.com');
  assert.equal(res.body.user.passwordHash, undefined);
});

test('Auth: Reject login with wrong password', async () => {
  const res = await request('POST', '/api/auth/login', {
    email: 'admin-a@saas.com',
    password: 'wrong-password'
  });
  assert.equal(res.status, 401);
});

test('Auth: Forgot password and reset password with OTP', async () => {
  // Clear lastOtpSentAt cooldown to test fresh forgot-password request
  await User.updateOne({ email: 'admin-a@saas.com' }, { $unset: { lastOtpSentAt: 1 } });

  const forgotRes = await request('POST', '/api/auth/forgot-password', {
    email: 'admin-a@saas.com'
  });
  assert.equal(forgotRes.status, 200);

  // Test that requesting again immediately triggers 429 cooldown
  const cooldownRes = await request('POST', '/api/auth/forgot-password', {
    email: 'admin-a@saas.com'
  });
  assert.equal(cooldownRes.status, 429);


  const userDoc = await User.findOne({ email: 'admin-a@saas.com' }).select('+resetPasswordOtp +resetPasswordOtpExpires');
  const resetOtp = userDoc.createResetPasswordOtp();
  await userDoc.save();

  // Test invalid reset OTP rejection
  const badReset = await request('POST', '/api/auth/reset-password', {
    email: 'admin-a@saas.com',
    otp: '999999',
    newPassword: 'newPassword123'
  });
  assert.equal(badReset.status, 400);

  // Test valid reset OTP
  const resetRes = await request('POST', '/api/auth/reset-password', {
    email: 'admin-a@saas.com',
    otp: resetOtp,
    newPassword: 'passwordA123' // Keep passwordA123 for subsequent server tests
  });
  assert.equal(resetRes.status, 200);

  // Confirm login succeeds with password
  const loginRes = await request('POST', '/api/auth/login', {
    email: 'admin-a@saas.com',
    password: 'passwordA123'
  });
  assert.equal(loginRes.status, 200);
  userTokenA = loginRes.body.token;
});

test('Servers: Add connected 3x-ui server with encrypted password', async () => {
  const res = await request(
    'POST',
    '/api/servers',
    {
      nickname: 'US Node Production',
      panelUrl: mockPanel.url,
      panelUsername: 'admin',
      panelPassword: 'password123'
    },
    userTokenA
  );

  assert.equal(res.status, 201);
  assert.ok(res.body.server._id);
  assert.equal(res.body.server.nickname, 'US Node Production');
  assert.equal(res.body.server.status, 'online');
  assert.equal(res.body.server.inboundCount, 2);

  // CRITICAL SECURITY ASSERTION:
  assert.equal(res.body.server.panelPasswordEncrypted, undefined);
  assert.equal(res.body.server.panelPasswordIv, undefined);
  assert.equal(res.body.server.panelPasswordAuthTag, undefined);
  assert.equal(res.body.server.panelPassword, undefined);

  serverAId = res.body.server._id;

  // Verify in MongoDB directly that password was encrypted with AES-256-GCM
  const dbDoc = await Server.findById(serverAId).select('+panelPasswordEncrypted +panelPasswordIv +panelPasswordAuthTag');
  assert.ok(dbDoc.panelPasswordEncrypted);
  assert.notEqual(dbDoc.panelPasswordEncrypted, 'password123');
  assert.ok(dbDoc.panelPasswordIv);
  assert.ok(dbDoc.panelPasswordAuthTag);
});

test('Servers: GET /api/servers returns user servers with no secrets exposed', async () => {
  const res = await request('GET', '/api/servers', null, userTokenA);

  assert.equal(res.status, 200);
  assert.equal(res.body.servers.length, 1);
  const server = res.body.servers[0];
  assert.equal(server.nickname, 'US Node Production');
  assert.equal(server.panelPasswordEncrypted, undefined);
  assert.equal(server.panelPasswordIv, undefined);
  assert.equal(server.panelPasswordAuthTag, undefined);
  assert.equal(server.panelApiKeyEncrypted, undefined);
  assert.equal(server.panelApiKeyIv, undefined);
  assert.equal(server.panelApiKeyAuthTag, undefined);
});

test('Servers: Add connected 3x-ui server with encrypted API Key', async () => {
  const res = await request(
    'POST',
    '/api/servers',
    {
      nickname: 'Tokyo Node API Token',
      panelUrl: mockPanel.url,
      authType: 'api_key',
      apiKey: 'mock-api-key'
    },
    userTokenA
  );

  assert.equal(res.status, 201);
  assert.equal(res.body.server.nickname, 'Tokyo Node API Token');
  assert.equal(res.body.server.status, 'online');
  assert.equal(res.body.server.authType, 'api_key');

  // CRITICAL SECURITY ASSERTIONS: Never expose encrypted or raw API keys
  assert.equal(res.body.server.apiKey, undefined);
  assert.equal(res.body.server.panelApiKeyEncrypted, undefined);
  assert.equal(res.body.server.panelApiKeyIv, undefined);
  assert.equal(res.body.server.panelApiKeyAuthTag, undefined);

  // Check direct MongoDB doc has encrypted values
  const dbDoc = await Server.findById(res.body.server._id).select('+panelApiKeyEncrypted +panelApiKeyIv +panelApiKeyAuthTag');
  assert.ok(dbDoc.panelApiKeyEncrypted);
  assert.notEqual(dbDoc.panelApiKeyEncrypted, 'mock-api-key');
  assert.ok(dbDoc.panelApiKeyIv);
  assert.ok(dbDoc.panelApiKeyAuthTag);

  // Test live inbounds using API Key server
  const inboundsRes = await request('GET', `/api/servers/${res.body.server._id}/inbounds`, null, userTokenA);
  assert.equal(inboundsRes.status, 200);
  assert.equal(inboundsRes.body.inbounds.length, 2);
});

test('Tenant Isolation: User B cannot view User A servers', async () => {
  const resList = await request('GET', '/api/servers', null, userTokenB);
  assert.equal(resList.status, 200);
  assert.equal(resList.body.servers.length, 0, 'User B must not see User A servers');

  const resGet = await request('GET', `/api/servers/${serverAId}`, null, userTokenB);
  assert.equal(resGet.status, 404, 'User B must receive 404/not found for User A server');
});

test('Server Status Proxy: GET /api/servers/:id/status fetches instance CPU, RAM, Disk, and Uptime', async () => {
  const res = await request('GET', `/api/servers/${serverAId}/status`, null, userTokenA);

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.ok(res.body.status.cpu);
  assert.ok(res.body.status.mem);
  assert.ok(res.body.status.disk);
  assert.equal(res.body.status.xray.state, 'running');
  assert.ok(res.body.status.uptime > 0);
});

test('Inbounds Proxy: GET /api/servers/:id/inbounds fetches live inbounds', async () => {
  const res = await request('GET', `/api/servers/${serverAId}/inbounds`, null, userTokenA);


  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body.inbounds));
  assert.equal(res.body.inbounds.length, 2);
  assert.equal(res.body.inbounds[0].remark, 'US-East-VLESS-CDN');
  assert.equal(res.body.inbounds[0].protocol, 'vless');
});

test('Clients Proxy: GET /api/servers/:id/inbounds/:inboundId/clients fetches live clients', async () => {
  const res = await request('GET', `/api/servers/${serverAId}/inbounds/1/clients`, null, userTokenA);

  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body.clients));
  assert.equal(res.body.clients.length, 2);
  assert.equal(res.body.clients[0].email, 'alice@example.com');
  assert.equal(res.body.clients[1].email, 'bob@example.com');
});

test('Clients Proxy: POST /api/servers/:id/inbounds/:inboundId/clients adds a client live', async () => {
  const res = await request(
    'POST',
    `/api/servers/${serverAId}/inbounds/1/clients`,
    {
      email: 'newuser@example.com',
      totalGB: 25 * 1024 * 1024 * 1024,
      expiryTime: Date.now() + 30 * 86400000,
      enable: true
    },
    userTokenA
  );

  assert.equal(res.status, 201);
  assert.equal(res.body.success, true);
  assert.equal(res.body.client.email, 'newuser@example.com');

  // Verify client is present in inbound
  const listRes = await request('GET', `/api/servers/${serverAId}/inbounds/1/clients`, null, userTokenA);
  const found = listRes.body.clients.find((c) => c.email === 'newuser@example.com');
  assert.ok(found, 'New client should be found in live client list');
});


test('Clients Proxy: PATCH /api/servers/:id/clients/:clientId updates client live', async () => {
  const newExpiry = Date.now() + 60 * 86400000;
  const newBandwidth = 107374182400; // 100 GB

  const res = await request(
    'PATCH',
    `/api/servers/${serverAId}/clients/c1a11111-2222-3333-4444-555555555555`,
    {
      inboundId: 1,
      enable: false,
      totalGB: newBandwidth,
      expiryTime: newExpiry
    },
    userTokenA
  );

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.client.enable, false);
  assert.equal(res.body.client.totalGB, newBandwidth);
});

test('Clients Proxy: POST /api/servers/:id/clients/:clientId/reset-traffic resets traffic live', async () => {
  const res = await request(
    'POST',
    `/api/servers/${serverAId}/clients/c2b22222-3333-4444-5555-666666666666/reset-traffic?inboundId=1`,
    null,
    userTokenA
  );

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
});

test('Tenant Isolation: User B cannot modify or delete User A clients', async () => {
  const resPatch = await request(
    'PATCH',
    `/api/servers/${serverAId}/clients/c1a11111-2222-3333-4444-555555555555`,
    { enable: true },
    userTokenB
  );
  assert.equal(resPatch.status, 404);

  const resDelete = await request(
    'DELETE',
    `/api/servers/${serverAId}/clients/c1a11111-2222-3333-4444-555555555555`,
    null,
    userTokenB
  );
  assert.equal(resDelete.status, 404);
});

test('Clients Proxy: DELETE /api/servers/:id/clients/:clientId deletes client live', async () => {
  const res = await request(
    'DELETE',
    `/api/servers/${serverAId}/clients/c2b22222-3333-4444-5555-666666666666?inboundId=1`,
    null,
    userTokenA
  );

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);

  // Confirm client is deleted
  const clientsRes = await request('GET', `/api/servers/${serverAId}/inbounds/1/clients`, null, userTokenA);
  const deletedBob = clientsRes.body.clients.find((c) => c.email === 'bob@example.com');
  assert.equal(deletedBob, undefined, 'Deleted client should no longer be present');
});

test('Servers: DELETE /api/servers/:id deletes server', async () => {
  const res = await request('DELETE', `/api/servers/${serverAId}`, null, userTokenA);
  assert.equal(res.status, 200);

  // Also clean up any other added test servers
  const remaining = await request('GET', '/api/servers', null, userTokenA);
  for (const s of remaining.body.servers) {
    await request('DELETE', `/api/servers/${s._id}`, null, userTokenA);
  }

  const listRes = await request('GET', '/api/servers', null, userTokenA);
  assert.equal(listRes.body.servers.length, 0);
});
