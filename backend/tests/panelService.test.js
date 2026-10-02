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

test('panelService.addClient: adds a new client to inbound', async () => {
  const addResult = await panelService.addClient(
    mockServer.url,
    'admin',
    'password123',
    1,
    {
      email: 'carol@example.com',
      totalGB: 50 * 1024 * 1024 * 1024,
      expiryTime: 1800000000000,
      enable: true
    }
  );

  assert.equal(addResult.success, true);
  assert.equal(addResult.client.email, 'carol@example.com');

  const clients = await panelService.getInboundClients(mockServer.url, 'admin', 'password123', 1);
  const carol = clients.find((c) => c.email === 'carol@example.com');
  assert.ok(carol, 'Carol should be found in live clients list');
  assert.equal(carol.enable, true);
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
});

test('panelService.restartXray: restarts Xray service on panel', async () => {
  const result = await panelService.restartXray(
    mockServer.url,
    'admin',
    'password123'
  );

  assert.equal(result.success, true);
  assert.match(result.message, /restarted/i);
});

test('panelService.getInbounds: returns streamSettings and settings', async () => {
  const inbounds = await panelService.getInbounds(mockServer.url, 'admin', 'password123');
  assert.equal(Array.isArray(inbounds), true);
  assert.ok(inbounds[0].streamSettings, 'streamSettings should be present');
  assert.ok(inbounds[0].settings, 'settings should be present');

  const stream = typeof inbounds[0].streamSettings === 'string' ? JSON.parse(inbounds[0].streamSettings) : inbounds[0].streamSettings;
  assert.equal(stream.security, 'tls');
  assert.equal(stream.tlsSettings.serverName, '47.237.81.102');
});

test('linkGenerator: generates VLESS URI with security=tls, sni, and fp matching panel link', () => {
  const { generateClientLinks } = require('../src/utils/linkGenerator');
  const mockInbound = {
    id: 1,
    protocol: 'vless',
    port: 443,
    listen: '',
    remark: 'test_user',
    streamSettings: JSON.stringify({
      network: 'tcp',
      security: 'tls',
      tlsSettings: {
        serverName: '47.237.81.102',
        settings: {
          fingerprint: 'chrome'
        }
      }
    })
  };
  const mockClient = {
    id: 'aaff9565-0881-4fa6-a342-45db2404f22e',
    email: 'test_user',
    flow: ''
  };
  const links = generateClientLinks(mockClient, mockInbound, 'https://47.237.81.102:2053');
  assert.equal(
    links.v2rayLink,
    'vless://aaff9565-0881-4fa6-a342-45db2404f22e@47.237.81.102:443?type=tcp&security=tls&encryption=none&sni=47.237.81.102&fp=chrome#test_user'
  );
});

test('linkGenerator: falls back to panel hostname for SNI and chrome for fp when not explicitly set', () => {
  const { generateClientLinks } = require('../src/utils/linkGenerator');
  const mockInbound = {
    id: 1,
    protocol: 'vless',
    port: 443,
    listen: '',
    remark: 'test_user',
    streamSettings: JSON.stringify({
      network: 'tcp',
      security: 'tls',
      tlsSettings: {}
    })
  };
  const mockClient = {
    id: 'aaff9565-0881-4fa6-a342-45db2404f22e',
    email: 'test_user'
  };
  const links = generateClientLinks(mockClient, mockInbound, 'https://47.237.81.102:2053');
  assert.ok(links.v2rayLink.includes('sni=47.237.81.102'), 'should have host as sni');
  assert.ok(links.v2rayLink.includes('security=tls'), 'should have security=tls');
  assert.ok(links.v2rayLink.includes('fp=chrome'), 'should have fp=chrome');
});

test('panelService.deleteClient: disambiguates arguments when passed as (inboundId, clientId)', async () => {
  // First add a client
  await panelService.addClient(mockServer.url, 'admin', 'password123', 1, {
    email: 'test-del-swap@example.com',
    totalGB: 1000
  });

  const clients = await panelService.getInboundClients(mockServer.url, 'admin', 'password123', 1);
  const target = clients.find((c) => c.email === 'test-del-swap@example.com');
  assert.ok(target, 'Client should exist before deletion');

  // Delete with inverted arguments: (inboundId, clientId)
  const delRes = await panelService.deleteClient(
    mockServer.url,
    'admin',
    'password123',
    1, // inboundId first!
    target.id // clientId second!
  );
  assert.equal(delRes.success, true);

  const postClients = await panelService.getInboundClients(mockServer.url, 'admin', 'password123', 1);
  const deletedTarget = postClients.find((c) => c.email === 'test-del-swap@example.com');
  assert.equal(deletedTarget, undefined, 'Client should be successfully deleted despite inverted arguments');
});

test('panelService.resetClientTraffic: disambiguates arguments when passed as (inboundId, clientEmail)', async () => {
  // Reset with inverted arguments: (inboundId, clientEmail)
  const resetRes = await panelService.resetClientTraffic(
    mockServer.url,
    'admin',
    'password123',
    1, // inboundId first!
    'alice@example.com' // email second!
  );
  assert.equal(resetRes.success, true);
  assert.equal(resetRes.email, 'alice@example.com');
});

test('panelService.updateInbound: updates total quota and expiry on inbound', async () => {
  const result = await panelService.updateInbound(
    mockServer.url,
    'admin',
    'password123',
    1,
    {
      totalGB: 250,
      expiryDays: 30,
      remark: 'US-East-Updated-Quota'
    }
  );

  assert.equal(result.success, true);
  assert.equal(result.inboundId, 1);
  assert.equal(result.totalGB, 250);
  assert.equal(result.remark, 'US-East-Updated-Quota');

  const inbounds = await panelService.getInbounds(mockServer.url, 'admin', 'password123');
  const ib1 = inbounds.find((ib) => ib.id === 1);
  assert.equal(ib1.total, 250 * 1073741824);
  assert.equal(ib1.remark, 'US-East-Updated-Quota');
});

test('panelService.resetInboundTraffic: resets up and down traffic counters on inbound', async () => {
  const result = await panelService.resetInboundTraffic(
    mockServer.url,
    'admin',
    'password123',
    1
  );

  assert.equal(result.success, true);
  assert.equal(result.inboundId, 1);

  const inbounds = await panelService.getInbounds(mockServer.url, 'admin', 'password123');
  const ib1 = inbounds.find((ib) => ib.id === 1);
  assert.equal(ib1.up, 0);
  assert.equal(ib1.down, 0);
});





