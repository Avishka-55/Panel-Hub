const http = require('http');

/**
 * Creates a standalone mock 3x-ui HTTP server for integration testing and local simulation.
 * Implements the exact endpoints:
 * - POST /login
 * - GET /panel/api/inbounds/list
 * - POST /panel/api/inbounds/updateClient/:clientId
 * - POST /panel/api/inbounds/:id/delClient/:clientId
 * - POST /panel/api/inbounds/:id/resetClientTraffic/:email
 * - POST /panel/api/inbounds/addClient
 */
function createMock3xUiServer(port = 0, defaultUsername = 'admin', defaultPassword = 'password123') {
  let mockInbounds = [
    {
      id: 1,
      up: 104857600, // 100 MB
      down: 2147483648, // 2 GB
      total: 107374182400, // 100 GB
      remark: 'US-East-VLESS-CDN',
      enable: true,
      expiryTime: Date.now() + 30 * 86400000,
      listen: '',
      port: 443,
      protocol: 'vless',
      settings: JSON.stringify({
        clients: [
          {
            id: 'c1a11111-2222-3333-4444-555555555555',
            email: 'alice@example.com',
            enable: true,
            totalGB: 53687091200, // 50 GB
            expiryTime: Date.now() + 15 * 86400000,
            subId: 'sub-alice-01',
            limitIp: 2
          },
          {
            id: 'c2b22222-3333-4444-5555-666666666666',
            email: 'bob@example.com',
            enable: true,
            totalGB: 10737418240, // 10 GB
            expiryTime: Date.now() + 3 * 86400000,
            subId: 'sub-bob-02',
            limitIp: 1
          }
        ]
      }),
      streamSettings: JSON.stringify({ network: 'ws', security: 'tls' }),
      tag: 'inbound-443',
      sniffing: '',
      clientStats: [
        {
          id: 1,
          inboundId: 1,
          enable: true,
          email: 'alice@example.com',
          up: 52428800, // 50 MB
          down: 1073741824, // 1 GB
          expiryTime: Date.now() + 15 * 86400000,
          total: 53687091200,
          reset: 0
        },
        {
          id: 2,
          inboundId: 1,
          enable: true,
          email: 'bob@example.com',
          up: 10485760, // 10 MB
          down: 524288000, // 500 MB
          expiryTime: Date.now() + 3 * 86400000,
          total: 10737418240,
          reset: 0
        }
      ]
    },
    {
      id: 2,
      up: 52428800,
      down: 524288000,
      total: 0,
      remark: 'DE-Frankfurt-Trojan',
      enable: true,
      expiryTime: 0,
      listen: '',
      port: 8443,
      protocol: 'trojan',
      settings: JSON.stringify({
        clients: [
          {
            id: 'trojan-secret-pass-001',
            password: 'trojan-secret-pass-001',
            email: 'charlie@vpn.de',
            enable: true,
            totalGB: 21474836480, // 20 GB
            expiryTime: Date.now() + 60 * 86400000
          }
        ]
      }),
      streamSettings: JSON.stringify({ network: 'tcp', security: 'tls' }),
      tag: 'inbound-8443',
      sniffing: '',
      clientStats: [
        {
          id: 3,
          inboundId: 2,
          enable: true,
          email: 'charlie@vpn.de',
          up: 52428800,
          down: 524288000,
          expiryTime: Date.now() + 60 * 86400000,
          total: 21474836480,
          reset: 0
        }
      ]
    }
  ];

  const sessions = new Set();

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;

    let body = '';
    for await (const chunk of req) {
      body += chunk;
    }

    let parsedBody = {};
    if (body) {
      try {
        parsedBody = JSON.parse(body);
      } catch (_) {
        const params = new URLSearchParams(body);
        for (const [key, value] of params.entries()) {
          parsedBody[key] = value;
        }
      }
    }

    // Auth check helper
    const checkAuth = () => {
      const cookieHeader = req.headers.cookie || '';
      return cookieHeader.includes('session=mock-3x-ui-session-token');
    };

    // Route: POST /login
    if (pathname === '/login' && req.method === 'POST') {
      const { username, password } = parsedBody;
      if (username === defaultUsername && password === defaultPassword) {
        sessions.add('mock-3x-ui-session-token');
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Set-Cookie': 'session=mock-3x-ui-session-token; Path=/; HttpOnly'
        });
        return res.end(JSON.stringify({ success: true, msg: 'Login successful' }));
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, msg: 'Wrong username or password' }));
    }

    // Require cookie for subsequent endpoints
    if (!checkAuth()) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, msg: 'Please log in' }));
    }

    // Route: GET /panel/api/inbounds/list
    if (pathname === '/panel/api/inbounds/list' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: true, msg: 'Inbounds fetched', obj: mockInbounds }));
    }

    // Route: POST /panel/api/inbounds/updateClient/:clientId
    const updateClientMatch = pathname.match(/^\/panel\/api\/inbounds\/updateClient\/(.+)$/);
    if (updateClientMatch && req.method === 'POST') {
      const clientId = decodeURIComponent(updateClientMatch[1]);
      const inboundId = Number(parsedBody.id);
      let updatedClientData = null;

      try {
        const clientSettings = typeof parsedBody.settings === 'string'
          ? JSON.parse(parsedBody.settings)
          : parsedBody.settings;
        updatedClientData = clientSettings?.clients?.[0];
      } catch (_) {}

      const inbound = mockInbounds.find((ib) => ib.id === inboundId);
      if (inbound && updatedClientData) {
        const currentSettings = JSON.parse(inbound.settings);
        const idx = currentSettings.clients.findIndex(
          (c) => String(c.id) === clientId || String(c.password) === clientId || String(c.email) === clientId
        );

        if (idx !== -1) {
          currentSettings.clients[idx] = { ...currentSettings.clients[idx], ...updatedClientData };
          inbound.settings = JSON.stringify(currentSettings);

          // Update stats if needed
          const stat = inbound.clientStats?.find(
            (s) => s.email === currentSettings.clients[idx].email || String(s.id) === clientId
          );
          if (stat) {
            stat.total = updatedClientData.totalGB || stat.total;
            stat.expiryTime = updatedClientData.expiryTime || stat.expiryTime;
            stat.enable = updatedClientData.enable !== undefined ? updatedClientData.enable : stat.enable;
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: true, msg: 'Client updated successfully' }));
        }
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, msg: 'Client not found or update failed' }));
    }

    // Route: POST /panel/api/inbounds/:id/delClient/:clientId
    const delClientMatch = pathname.match(/^\/panel\/api\/inbounds\/(\d+)\/delClient\/(.+)$/);
    if (delClientMatch && req.method === 'POST') {
      const inboundId = Number(delClientMatch[1]);
      const clientId = decodeURIComponent(delClientMatch[2]);

      const inbound = mockInbounds.find((ib) => ib.id === inboundId);
      if (inbound) {
        const currentSettings = JSON.parse(inbound.settings);
        const client = currentSettings.clients.find(
          (c) => String(c.id) === clientId || String(c.password) === clientId || String(c.email) === clientId
        );
        if (client) {
          currentSettings.clients = currentSettings.clients.filter((c) => c !== client);
          inbound.settings = JSON.stringify(currentSettings);
          inbound.clientStats = (inbound.clientStats || []).filter((s) => s.email !== client.email);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: true, msg: 'Client deleted' }));
        }
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, msg: 'Client or inbound not found' }));
    }

    // Route: POST /panel/api/inbounds/:id/resetClientTraffic/:email
    const resetTrafficMatch = pathname.match(/^\/panel\/api\/inbounds\/(\d+)\/resetClientTraffic\/(.+)$/);
    if (resetTrafficMatch && req.method === 'POST') {
      const inboundId = Number(resetTrafficMatch[1]);
      const email = decodeURIComponent(resetTrafficMatch[2]);

      const inbound = mockInbounds.find((ib) => ib.id === inboundId);
      if (inbound && inbound.clientStats) {
        const stat = inbound.clientStats.find((s) => s.email === email);
        if (stat) {
          stat.up = 0;
          stat.down = 0;
          stat.reset = (stat.reset || 0) + 1;
        }
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: true, msg: 'Client traffic reset' }));
    }

    // Route: POST /panel/api/inbounds/addClient
    if (pathname === '/panel/api/inbounds/addClient' && req.method === 'POST') {
      const inboundId = Number(parsedBody.id);
      const inbound = mockInbounds.find((ib) => ib.id === inboundId);
      if (inbound) {
        const clientSettings = typeof parsedBody.settings === 'string'
          ? JSON.parse(parsedBody.settings)
          : parsedBody.settings;
        const newClient = clientSettings?.clients?.[0];
        if (newClient) {
          const currentSettings = JSON.parse(inbound.settings);
          currentSettings.clients.push(newClient);
          inbound.settings = JSON.stringify(currentSettings);
          inbound.clientStats = inbound.clientStats || [];
          inbound.clientStats.push({
            id: inbound.clientStats.length + 1,
            inboundId,
            enable: newClient.enable !== false,
            email: newClient.email,
            up: 0,
            down: 0,
            expiryTime: newClient.expiryTime || 0,
            total: newClient.totalGB || 0,
            reset: 0
          });
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: true, msg: 'Client added' }));
        }
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, msg: 'Failed to add client' }));
    }

    // 404
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, msg: 'Endpoint not found' }));
  });

  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => {
      const addr = server.address();
      const actualPort = typeof addr === 'object' ? addr.port : port;
      resolve({
        server,
        port: actualPort,
        url: `http://127.0.0.1:${actualPort}`,
        username: defaultUsername,
        password: defaultPassword,
        close: () => new Promise((cb) => server.close(cb))
      });
    });
  });
}

module.exports = {
  createMock3xUiServer
};
