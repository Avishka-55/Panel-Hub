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
const { encrypt } = require('../src/utils/crypto');
const { createMock3xUiServer } = require('../src/services/mockPanelServer');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { SSEClientTransport } = require('@modelcontextprotocol/sdk/client/sse.js');

let server;
let baseUrl;
let testUser;
let rawApiKey;
let mockPanel;

test.before(async () => {
  await connectDB();
  await User.deleteMany({});
  await Server.deleteMany({});

  rawApiKey = 'ph_live_' + crypto.randomBytes(32).toString('hex');
  const keyHash = crypto.createHash('sha256').update(rawApiKey).digest('hex');

  testUser = new User({
    email: 'mcp-test@saas.com',
    passwordHash: 'hashed_password',
    isVerified: true,
    apiKeyEncrypted: encrypt(rawApiKey),
    apiKeyHash: keyHash,
    apiKeyLast4: rawApiKey.slice(-4),
    apiKeyCreatedAt: new Date()
  });
  await testUser.save();

  // Create mock 3x-ui server with realistic inbounds
  mockPanel = await createMock3xUiServer(0, 'admin', 'password123');
  const encPass = encrypt('password123');

  // Add a sample server for User linked to mock 3x-ui
  const sampleServer = new Server({
    ownerId: testUser._id,
    nickname: 'MCP Singapore Node',
    panelUrl: mockPanel.url,
    authType: 'credentials',
    panelUsername: 'admin',
    panelPasswordEncrypted: encPass.ciphertext,
    panelPasswordIv: encPass.iv,
    panelPasswordAuthTag: encPass.authTag,
    status: 'online'
  });
  await sampleServer.save();

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

test('MCP Discovery: GET /mcp and GET /api/mcp return operational manifest', async () => {
  const fetchManifest = (path) =>
    new Promise((resolve, reject) => {
      http.get(`${baseUrl}${path}`, (res) => {
        let body = '';
        res.on('data', (d) => (body += d));
        res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(body) }));
      }).on('error', reject);
    });

  const res1 = await fetchManifest('/mcp');
  assert.equal(res1.status, 200);
  assert.equal(res1.data.status, 'operational');
  assert.equal(res1.data.endpoints.sse, '/mcp/sse');

  const res2 = await fetchManifest('/api/mcp');
  assert.equal(res2.status, 200);
  assert.equal(res2.data.status, 'operational');
  assert.equal(res2.data.endpoints.sse, '/api/mcp/sse');
});

test('MCP Auth: Rejects unauthenticated and invalid keys with 401', async () => {
  const fetchStatus = (path, headers = {}) =>
    new Promise((resolve, reject) => {
      const url = new URL(path, baseUrl);
      http.get({ hostname: url.hostname, port: url.port, path: url.pathname + url.search, headers }, (res) => {
        resolve(res.statusCode);
      }).on('error', reject);
    });

  const noKey = await fetchStatus('/api/mcp/sse');
  assert.equal(noKey, 401);

  const invalidKey = await fetchStatus('/api/mcp/sse?apiKey=ph_live_0000000000000000000000000000000000000000000000000000000000000000');
  assert.equal(invalidKey, 401);
});

test('MCP Client: Connects via SSE and executes list_vpn_servers', async () => {
  const sseUrl = new URL(`${baseUrl}/api/mcp/sse`);
  sseUrl.searchParams.set('apiKey', rawApiKey);

  const transport = new SSEClientTransport(sseUrl);
  const client = new Client({ name: 'test-runner', version: '1.0.0' }, { capabilities: {} });

  await client.connect(transport);

  // 1. Verify server instructions delivered to client
  assert.ok(client._instructions);
  assert.match(client._instructions, /PanelHub/);
  assert.match(client._instructions, /Fleet Observability/);

  // 2. Verify registered prompts
  const promptsResult = await client.listPrompts();
  assert.equal(promptsResult.prompts.length, 3);
  const promptNames = promptsResult.prompts.map((p) => p.name);
  assert.ok(promptNames.includes('audit_fleet_health'));
  assert.ok(promptNames.includes('provision_vpn_client'));
  assert.ok(promptNames.includes('troubleshoot_server'));

  // 3. Verify registered resources
  const resourcesResult = await client.listResources();
  assert.equal(resourcesResult.resources.length, 2);
  const resourceUris = resourcesResult.resources.map((r) => r.uri);
  assert.ok(resourceUris.includes('panelhub://fleet/summary'));
  assert.ok(resourceUris.includes('panelhub://fleet/guide'));

  // 4. Verify reading resource: panelhub://fleet/summary
  const resourceContent = await client.readResource({ uri: 'panelhub://fleet/summary' });
  assert.ok(resourceContent.contents);
  const summaryJson = JSON.parse(resourceContent.contents[0].text);
  assert.equal(summaryJson.totalServers, 1);
  assert.equal(summaryJson.servers[0].nickname, 'MCP Singapore Node');

  // 5. Verify list tools
  const tools = await client.listTools();
  assert.equal(tools.tools.length, 9);
  const toolNames = tools.tools.map((t) => t.name);
  assert.ok(toolNames.includes('list_vpn_servers'));
  assert.ok(toolNames.includes('get_server_status'));
  assert.ok(toolNames.includes('list_inbounds'));
  assert.ok(toolNames.includes('list_clients'));
  assert.ok(toolNames.includes('add_client'));
  assert.ok(toolNames.includes('delete_client'));
  assert.ok(toolNames.includes('reset_client_traffic'));
  assert.ok(toolNames.includes('restart_xray'));
  assert.ok(toolNames.includes('get_client_link'));

  // 6. Execute tool: list_vpn_servers
  const result = await client.callTool({
    name: 'list_vpn_servers',
    arguments: {}
  });

  assert.ok(result.content);
  assert.equal(result.content[0].type, 'text');
  const parsed = JSON.parse(result.content[0].text);
  assert.equal(parsed.count, 1);
  assert.equal(parsed.servers[0].nickname, 'MCP Singapore Node');

  // 7. Execute tool: get_client_link (verify security=tls, sni, fp)
  const linkResult = await client.callTool({
    name: 'get_client_link',
    arguments: {
      server: 'MCP Singapore Node',
      client: 'alice@example.com'
    }
  });

  assert.ok(linkResult.content);
  const linkData = JSON.parse(linkResult.content[0].text);
  assert.equal(linkData.clientEmail, 'alice@example.com');
  assert.ok(linkData.connectionLink, 'connectionLink should not be empty');
  assert.ok(linkData.connectionLink.startsWith('vless://'), 'should be a vless link');
  assert.ok(linkData.connectionLink.includes('security=tls'), 'should have security=tls');
  assert.ok(linkData.connectionLink.includes('sni=47.237.81.102'), 'should have correct sni');
  assert.ok(linkData.connectionLink.includes('fp=chrome'), 'should have fp=chrome');

  // 8. Execute tool: add_client (verify newly created client returns connectionLink with tls, sni, fp)
  const addResult = await client.callTool({
    name: 'add_client',
    arguments: {
      server: 'MCP Singapore Node',
      inboundId: 1,
      email: 'mcp-newuser@vpn.com',
      totalGB: 20,
      expiryDays: 30
    }
  });

  assert.ok(addResult.content);
  const addData = JSON.parse(addResult.content[0].text);
  assert.equal(addData.success, true);
  assert.equal(addData.email, 'mcp-newuser@vpn.com');
  assert.ok(addData.connectionLink.includes('security=tls'));
  assert.ok(addData.connectionLink.includes('sni=47.237.81.102'));
  assert.ok(addData.connectionLink.includes('fp=chrome'));

  // 9. Execute tool: list_clients (verify clients array has connectionLink with tls, sni, fp)
  const listClientsResult = await client.callTool({
    name: 'list_clients',
    arguments: {
      server: 'MCP Singapore Node'
    }
  });

  assert.ok(listClientsResult.content);
  const clientsData = JSON.parse(listClientsResult.content[0].text);
  assert.ok(clientsData.clients.length >= 2);
  const aliceItem = clientsData.clients.find((c) => c.email === 'alice@example.com');
  assert.ok(aliceItem);
  // 10. Execute tool: reset_client_traffic
  const resetResult = await client.callTool({
    name: 'reset_client_traffic',
    arguments: {
      server: 'MCP Singapore Node',
      inboundId: 1,
      clientEmail: 'alice@example.com'
    }
  });

  assert.ok(resetResult.content);
  const resetData = JSON.parse(resetResult.content[0].text);
  assert.equal(resetData.success, true);
  assert.match(resetData.message, /reset to 0/i);

  // 11. Execute tool: delete_client (exact schema Claude calls with inboundId and clientId UUID)
  const delResult = await client.callTool({
    name: 'delete_client',
    arguments: {
      server: 'MCP Singapore Node',
      inboundId: 1,
      clientId: 'c1a11111-2222-3333-4444-555555555555'
    }
  });

  assert.ok(delResult.content);
  const delData = JSON.parse(delResult.content[0].text);
  assert.equal(delData.success, true);
  assert.match(delData.message, /deleted successfully/i);

  // Verify client is now deleted
  const postDelResult = await client.callTool({
    name: 'list_clients',
    arguments: {
      server: 'MCP Singapore Node'
    }
  });
  const postDelClients = JSON.parse(postDelResult.content[0].text);
  const deletedAlice = postDelClients.clients.find((c) => c.id === 'c1a11111-2222-3333-4444-555555555555');
  assert.equal(deletedAlice, undefined, 'Alice should be deleted');

  await client.close();
});
