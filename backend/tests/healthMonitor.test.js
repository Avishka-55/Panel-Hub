const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const http = require('http');

process.env.NODE_ENV = 'test';
process.env.MASTER_KEY = crypto.randomBytes(32).toString('hex');
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/panelhub_test';
process.env.JWT_SECRET = 'test-jwt-secret-key';

const app = require('../src/app');
const { connectDB, disconnectDB } = require('../src/config/db');
const User = require('../src/models/User');
const Server = require('../src/models/Server');
const { createMock3xUiServer } = require('../src/services/mockPanelServer');
const { checkServer, checkAllServers } = require('../src/services/healthMonitorService');
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

test('Health Monitor Suite Setup', async () => {
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

  // Create verified user
  const bcrypt = require('bcryptjs');
  const passwordHash = await bcrypt.hash('password123', 10);
  await User.deleteMany({ email: 'monitor-test@saas.com' });
  testUser = await User.create({
    email: 'monitor-test@saas.com',
    passwordHash,
    name: 'Monitor Admin',
    isVerified: true
  });

  const loginRes = await request('POST', '/api/auth/login', {
    email: 'monitor-test@saas.com',
    password: 'password123'
  });
  testToken = loginRes.body.token;

  // Create server doc
  const enc = encrypt('password123');
  testServerDoc = await Server.create({
    ownerId: testUser._id,
    nickname: 'Monitored Node',
    panelUrl: mockPanel.url,
    authType: 'credentials',
    panelUsername: 'admin',
    panelPasswordEncrypted: enc.ciphertext,
    panelPasswordIv: enc.iv,
    panelPasswordAuthTag: enc.authTag,
    status: 'untested',
    monitoring: { enabled: true, emailAlerts: true }
  });
});

test('Health Monitor: checkServer updates server to online and populates telemetry', async () => {
  const loadedServer = await Server.findById(testServerDoc._id)
    .populate('ownerId', 'email name')
    .select('+panelPasswordEncrypted +panelPasswordIv +panelPasswordAuthTag');

  const result = await checkServer(loadedServer);
  assert.equal(result.status, 'online');
  assert.ok(result.telemetry);
  assert.equal(typeof result.telemetry.cpu, 'number');
  assert.equal(typeof result.telemetry.memPercent, 'number');

  const refreshed = await Server.findById(testServerDoc._id);
  assert.equal(refreshed.status, 'online');
  assert.equal(refreshed.failureCount, 0);
  assert.ok(refreshed.lastCheckedAt);
});

test('Health Monitor: checkServer detects offline server when unreachable', async () => {
  const loadedServer = await Server.findById(testServerDoc._id)
    .populate('ownerId', 'email name')
    .select('+panelPasswordEncrypted +panelPasswordIv +panelPasswordAuthTag');

  // Point to unreachable port
  loadedServer.panelUrl = 'http://127.0.0.1:59999';

  const result = await checkServer(loadedServer);
  assert.equal(result.status, 'offline');
  assert.ok(result.error);

  const refreshed = await Server.findById(testServerDoc._id);
  assert.equal(refreshed.status, 'offline');
  assert.equal(refreshed.lastAlertState, 'down');
  assert.ok(refreshed.lastAlertSentAt);
});

test('Health Monitor: checkServer detects recovery when server comes back online', async () => {
  const loadedServer = await Server.findById(testServerDoc._id)
    .populate('ownerId', 'email name')
    .select('+panelPasswordEncrypted +panelPasswordIv +panelPasswordAuthTag');

  // Restore valid mock panel url
  loadedServer.panelUrl = mockPanel.url;

  const result = await checkServer(loadedServer);
  assert.equal(result.status, 'online');

  const refreshed = await Server.findById(testServerDoc._id);
  assert.equal(refreshed.status, 'online');
  assert.equal(refreshed.lastAlertState, 'recovered');
  assert.equal(refreshed.failureCount, 0);
});

test('API: POST /api/servers/health/check-all sweeps user servers', async () => {
  const res = await request('POST', '/api/servers/health/check-all', {}, testToken);
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.ok(Array.isArray(res.body.results));
  assert.ok(Array.isArray(res.body.servers));
  assert.equal(res.body.results[0].status, 'online');
});

test('API: PATCH /api/servers/:id/monitoring updates granular alert preferences', async () => {
  const res = await request(
    'PATCH',
    `/api/servers/${testServerDoc._id}/monitoring`,
    {
      enabled: true,
      emailAlerts: true,
      notifyOnDown: true,
      notifyOnRecover: true,
      notifyOnHighResource: true,
      cpuThreshold: 85,
      ramThreshold: 80,
      consecutiveFails: 2
    },
    testToken
  );

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.monitoring.notifyOnHighResource, true);
  assert.equal(res.body.monitoring.cpuThreshold, 85);
  assert.equal(res.body.monitoring.ramThreshold, 80);
  assert.equal(res.body.monitoring.consecutiveFails, 2);

  const refreshed = await Server.findById(testServerDoc._id);
  assert.equal(refreshed.monitoring.notifyOnHighResource, true);
  assert.equal(refreshed.monitoring.cpuThreshold, 85);
});

test('API: POST /api/servers/:id/monitoring/test-alert dispatches sample test email', async () => {
  const res = await request(
    'POST',
    `/api/servers/${testServerDoc._id}/monitoring/test-alert`,
    {},
    testToken
  );

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.ok(res.body.message.includes('Test verification email dispatched'));
});

test('Health Monitor Suite Teardown', async () => {
  await Server.deleteMany({ ownerId: testUser._id });
  await User.deleteMany({ email: 'monitor-test@saas.com' });
  if (server) await new Promise((r) => server.close(r));
  if (mockPanel) await mockPanel.close();
  await disconnectDB();
});
