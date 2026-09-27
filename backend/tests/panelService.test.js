const test = require('node:test');
const assert = require('node:assert/strict');
const { createMock3xUiServer } = require('../src/services/mockPanelServer');
const panelService = require('../src/services/panelService');

let mockServer;

test.before(async () => {
  mockServer = await createMock3xUiServer(0, 'admin', 'password123');
});

test.after(async () => {
  if (mockServer) {
    await mockServer.close();
  }
});

test('panelService.testConnection: succeeds with correct credentials', async () => {
  const result = await panelService.testConnection(mockServer.url, 'admin', 'password123');
  assert.equal(result.success, true);
  assert.equal(result.inboundCount, 2);
});

test('panelService.testConnection: throws on wrong password', async () => {
  await assert.rejects(
    async () => {
      await panelService.testConnection(mockServer.url, 'admin', 'wrongpass');
    },
    /Authentication failed|rejected/
  );
});

test('panelService.getInbounds: returns inbounds array with metadata', async () => {
  const inbounds = await panelService.getInbounds(mockServer.url, 'admin', 'password123');
  assert.equal(Array.isArray(inbounds), true);
  assert.equal(inbounds.length, 2);
  assert.equal(inbounds[0].id, 1);
  assert.equal(inbounds[0].remark, 'US-East-VLESS-CDN');
  assert.equal(inbounds[0].protocol, 'vless');
  assert.equal(inbounds[0].clientCount, 2);
});

test('panelService.getInboundClients: returns parsed live client list with stats', async () => {
  const clients = await panelService.getInboundClients(mockServer.url, 'admin', 'password123', 1);
  assert.equal(Array.isArray(clients), true);
  assert.equal(clients.length, 2);

  const alice = clients.find((c) => c.email === 'alice@example.com');
  assert.ok(alice);
  assert.equal(alice.enable, true);
  assert.equal(alice.protocol, 'vless');
  assert.equal(alice.inboundId, 1);
  assert.equal(alice.up, 52428800);
});

test('panelService.updateClient: updates client expiry, quota, and enabled state', async () => {
  const newExpiry = Date.now() + 90 * 86400000;
  const newQuota = 85899345920; // 80 GB

  const updateResult = await panelService.updateClient(
    mockServer.url,
    'admin',
    'password123',
    'c1a11111-2222-3333-4444-555555555555',
    {
      inboundId: 1,
      enable: false,
      totalGB: newQuota,
      expiryTime: newExpiry
    }
  );

  assert.equal(updateResult.success, true);

  // Verify the updated data in live clients call
  const clients = await panelService.getInboundClients(mockServer.url, 'admin', 'password123', 1);
  const updatedAlice = clients.find((c) => c.email === 'alice@example.com');
  assert.equal(updatedAlice.enable, false);
  assert.equal(updatedAlice.totalGB, newQuota);
  assert.equal(updatedAlice.expiryTime, newExpiry);
});

test('panelService.resetClientTraffic: resets client traffic counters', async () => {
  const resetResult = await panelService.resetClientTraffic(
    mockServer.url,
    'admin',
    'password123',
    'c2b22222-3333-4444-5555-666666666666',
    1
  );

  assert.equal(resetResult.success, true);
  assert.equal(resetResult.email, 'bob@example.com');

  const clients = await panelService.getInboundClients(mockServer.url, 'admin', 'password123', 1);
  const bob = clients.find((c) => c.email === 'bob@example.com');
  assert.equal(bob.up, 0);
  assert.equal(bob.down, 0);
});

test('panelService.deleteClient: removes client from inbound', async () => {
  const deleteResult = await panelService.deleteClient(
    mockServer.url,
    'admin',
    'password123',
    'c2b22222-3333-4444-5555-666666666666',
    1
  );

  assert.equal(deleteResult.success, true);

  const clients = await panelService.getInboundClients(mockServer.url, 'admin', 'password123', 1);
  const bob = clients.find((c) => c.email === 'bob@example.com');
  assert.equal(bob, undefined, 'Bob should be deleted from inbound');
  assert.equal(clients.length, 1);
});
