const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const http = require('http');
const bcrypt = require('bcryptjs');

process.env.NODE_ENV = 'test';
process.env.MASTER_KEY = crypto.randomBytes(32).toString('hex');
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/panelhub_test';
process.env.JWT_SECRET = 'test-jwt-secret-key';

const app = require('../src/app');
const { connectDB, disconnectDB } = require('../src/config/db');
const User = require('../src/models/User');
const Server = require('../src/models/Server');
const { createMock3xUiServer } = require('../src/services/mockPanelServer');
const { encrypt } = require('../src/utils/crypto');

let mockPanel;
let server;
let baseUrl;
let testUser;
let testToken;
let testServerDoc;

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

test('Daily Report Suite Setup', async () => {
  await connectDB();
  mockPanel = await createMock3xUiServer(0, 'admin', 'password123');

  server = http.createServer(app);
  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });

  const passwordHash = await bcrypt.hash('password123', 10);
  await User.deleteMany({ email: 'report-test@saas.com' });
  testUser = await User.create({
    email: 'report-test@saas.com',
    passwordHash,
    name: 'Report Admin',
    isVerified: true,
    dailyReport: { enabled: true, hourUtc: 9 }
  });

  const loginRes = await request('POST', '/api/auth/login', {
    email: 'report-test@saas.com',
    password: 'password123'
  });
  testToken = loginRes.body.token;

  const enc = encrypt('password123');
  testServerDoc = await Server.create({
    ownerId: testUser._id,
    nickname: 'Report Test Node',
    panelUrl: mockPanel.url,
    authType: 'credentials',
    panelUsername: 'admin',
    panelPasswordEncrypted: enc.ciphertext,
    panelPasswordIv: enc.iv,
    panelPasswordAuthTag: enc.authTag,
    status: 'online',
    inboundCount: 1,
    telemetry: { cpu: 15, memPercent: 30, xrayState: 'running' }
  });
});

test('API: GET /api/reports/daily/preview returns report preview data', async () => {
  const res = await request('GET', '/api/reports/daily/preview', null, testToken);
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.ok(res.body.reportData);
  assert.ok(res.body.reportData.summary);
  assert.equal(res.body.reportData.summary.totalPanels, 1);
  assert.equal(res.body.reportData.summary.onlinePanels, 1);
  assert.ok(Array.isArray(res.body.reportData.serverBreakdown));
});

test('API: PATCH /api/reports/daily/preferences updates delivery hour and enabled state', async () => {
  const res = await request(
    'PATCH',
    '/api/reports/daily/preferences',
    { enabled: true, hourUtc: 14 },
    testToken
  );

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.preferences.hourUtc, 14);

  const refreshed = await User.findById(testUser._id);
  assert.equal(refreshed.dailyReport.hourUtc, 14);
});

test('API: POST /api/reports/daily/send-now dispatches daily operations report', async () => {
  const res = await request('POST', '/api/reports/daily/send-now', {}, testToken);
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.ok(res.body.message.includes('Daily operations digest dispatched'));
  assert.ok(res.body.summary);
});

test('Daily Report Suite Teardown', async () => {
  await Server.deleteMany({ ownerId: testUser._id });
  await User.deleteMany({ email: 'report-test@saas.com' });
  if (server) await new Promise((r) => server.close(r));
  if (mockPanel) await mockPanel.close();
  await disconnectDB();
});
