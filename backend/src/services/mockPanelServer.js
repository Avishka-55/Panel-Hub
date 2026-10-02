const http = require('http');

/**
 * Creates a standalone mock 3x-ui HTTP server for integration testing and local simulation.
 * Implements:
 * - Cookie session authentication (POST /login)
 * - Bearer API Token authentication (Authorization: Bearer mock-api-key)
 * - GET /panel/api/inbounds/list
 * - POST /panel/api/clients/update/:clientId & POST /panel/api/inbounds/updateClient/:clientId
 * - POST /panel/api/clients/del/:clientId & POST /panel/api/inbounds/:id/delClient/:clientId
 * - POST /panel/api/clients/resetTraffic/:email & POST /panel/api/inbounds/:id/resetClientTraffic/:email
 * - POST /panel/api/clients/add & POST /panel/api/inbounds/addClient
 */
function createMock3xUiServer(port = 0, defaultUsername = 'admin', defaultPassword = 'password123', defaultApiKey = 'mock-api-key') {
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
      streamSettings: JSON.stringify({
        network: 'ws',
        security: 'tls',
        tlsSettings: {
          serverName: '47.237.81.102',
          settings: {
            fingerprint: 'chrome'
          }
        },
        wsSettings: {
          path: '/vless-ws'
        }
      }),
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
      streamSettings: JSON.stringify({
        network: 'tcp',
        security: 'tls',
        tlsSettings: {
          serverName: 'trojan.example.com',
          settings: {
            fingerprint: 'chrome'
          }
        }
      }),
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

    // Auth check helper: supports session cookie OR Bearer API token
    const checkAuth = () => {
      const authHeader = req.headers.authorization || '';
      if (authHeader.startsWith('Bearer ') && authHeader.slice(7).trim() === defaultApiKey) {
        return true;
      }
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

    // Require authentication for subsequent endpoints
    if (!checkAuth()) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, msg: 'Please log in or provide valid API key' }));
    }

    // Route: GET /panel/api/inbounds/list
    if (pathname === '/panel/api/inbounds/list' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: true, msg: 'Inbounds fetched', obj: mockInbounds }));
    }

    // Route: GET /panel/api/server/status OR POST /server/status
    if ((pathname === '/panel/api/server/status' || pathname === '/server/status') && (req.method === 'GET' || req.method === 'POST')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        success: true,
        msg: 'Server status fetched',
        obj: {
          cpu: 12.5,
          cpuCores: 4,
          logicalPro: 4,
          cpuSpeedMhz: 2400,
          mem: {
            current: 1073741824, // 1 GB
            total: 4294967296    // 4 GB
          },
          swap: {
            current: 0,
            total: 1073741824
          },
          disk: {
            current: 15032385536, // 14 GB
            total: 53687091200    // 50 GB
          },
          xray: {
            state: 'running',
            version: '26.6.1',
            errorMsg: ''
          },
          panelVersion: '3.2.6',
          uptime: 864000, // 10 days
          loads: [0.15, 0.22, 0.18],
          tcpCount: 42,
          udpCount: 8,
          netIO: {
            up: 2048,
            down: 8192
          },
          netTraffic: {
            sent: 53687091200,
            recv: 107374182400
          },
          publicIP: {
            ipv4: '127.0.0.1'
          }
        }
      }));
    }

    // Route: POST /panel/api/server/restartXrayService OR /server/restartXrayService
    if (
      (pathname === '/panel/api/server/restartXrayService' ||
       pathname === '/server/restartXrayService' ||
       pathname === '/panel/server/restartXrayService') &&
      req.method === 'POST'
    ) {
      if (!checkAuth()) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, msg: 'Unauthorized' }));
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: true, msg: 'Xray service restarted successfully' }));
    }

    // Route: POST /panel/api/inbounds/onlines OR GET /panel/api/inbounds/onlines
    if (
      (pathname === '/panel/api/inbounds/onlines' || pathname === '/inbounds/onlines') &&
      (req.method === 'POST' || req.method === 'GET')
    ) {
      if (!checkAuth()) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, msg: 'Unauthorized' }));
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      // Alice is online, Bob is offline in the mock
      return res.end(JSON.stringify({ success: true, msg: '', obj: ['alice@example.com'] }));
    }

    // Route: POST /panel/api/inbounds/lastOnline OR GET /panel/api/inbounds/lastOnline
    if (
      (pathname === '/panel/api/inbounds/lastOnline' || pathname === '/inbounds/lastOnline') &&
      (req.method === 'POST' || req.method === 'GET')
    ) {
      if (!checkAuth()) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, msg: 'Unauthorized' }));
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        success: true,
        msg: '',
        obj: {
          'alice@example.com': Date.now(),
          'bob@example.com': Date.now() - 3600000
        }
      }));
    }

    // Route: POST /panel/api/clients/update/:clientId OR /panel/api/inbounds/updateClient/:clientId
    const modernUpdateMatch = pathname.match(/^\/panel\/api\/clients\/update\/(.+)$/);
    const classicUpdateMatch = pathname.match(/^\/panel\/api\/inbounds\/updateClient\/(.+)$/);

    if ((modernUpdateMatch || classicUpdateMatch) && req.method === 'POST') {
      const clientId = decodeURIComponent((modernUpdateMatch || classicUpdateMatch)[1]);
      let updatedClientData = parsedBody;

      // In classic mode, settings is serialized
      if (parsedBody.settings) {
        try {
          const clientSettings = typeof parsedBody.settings === 'string'
            ? JSON.parse(parsedBody.settings)
            : parsedBody.settings;
          updatedClientData = clientSettings?.clients?.[0] || parsedBody;
        } catch (_) {}
      }

      for (const inbound of mockInbounds) {
        const currentSettings = JSON.parse(inbound.settings);
        const idx = currentSettings.clients.findIndex(
          (c) => String(c.id) === clientId || String(c.password) === clientId || String(c.email) === clientId
        );

        if (idx !== -1) {
          currentSettings.clients[idx] = { ...currentSettings.clients[idx], ...updatedClientData };
          inbound.settings = JSON.stringify(currentSettings);

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

    // Route: POST /panel/api/clients/del/:clientId OR /panel/api/inbounds/:id/delClient/:clientId OR /panel/api/inbounds/delClient/:clientId
    const modernDelMatch = pathname.match(/^\/panel\/api\/clients\/del\/(.+)$/);
    const classicDelMatch = pathname.match(/^\/panel\/api\/inbounds\/(\d+)\/delClient\/(.+)$/);
    const mhsanaeiDelMatch = pathname.match(/^\/panel\/api\/inbounds\/delClient\/(.+)$/);

    if ((modernDelMatch || classicDelMatch || mhsanaeiDelMatch) && req.method === 'POST') {
      const clientId = decodeURIComponent(
        modernDelMatch ? modernDelMatch[1] : (classicDelMatch ? classicDelMatch[2] : mhsanaeiDelMatch[1])
      );

      for (const inbound of mockInbounds) {
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

    // Route: POST /panel/api/clients/resetTraffic/:email OR /panel/api/inbounds/:id/resetClientTraffic/:email OR /panel/api/inbounds/resetClientTraffic/:email
    const modernResetMatch = pathname.match(/^\/panel\/api\/clients\/resetTraffic\/(.+)$/);
    const classicResetMatch = pathname.match(/^\/panel\/api\/inbounds\/(\d+)\/resetClientTraffic\/(.+)$/);
    const mhsanaeiResetMatch = pathname.match(/^\/panel\/api\/inbounds\/resetClientTraffic\/(.+)$/);

    if ((modernResetMatch || classicResetMatch || mhsanaeiResetMatch) && req.method === 'POST') {
      const email = decodeURIComponent(
        modernResetMatch ? modernResetMatch[1] : (classicResetMatch ? classicResetMatch[2] : mhsanaeiResetMatch[1])
      );

      for (const inbound of mockInbounds) {
        if (inbound.clientStats) {
          const stat = inbound.clientStats.find((s) => s.email === email || String(s.id) === email);
          if (stat) {
            stat.up = 0;
            stat.down = 0;
            stat.reset = (stat.reset || 0) + 1;
          }
        }
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: true, msg: 'Client traffic reset' }));
    }

    // Route: POST /panel/api/clients/add OR /panel/api/inbounds/addClient
    if ((pathname === '/panel/api/clients/add' || pathname === '/panel/api/inbounds/addClient') && req.method === 'POST') {
      let inboundId = Number(parsedBody.inboundId || parsedBody.id || 1);
      let newClient = parsedBody;

      if (parsedBody.client) {
        newClient = parsedBody.client;
        if (Array.isArray(parsedBody.inboundIds) && parsedBody.inboundIds.length > 0) {
          inboundId = Number(parsedBody.inboundIds[0]);
        }
      } else if (parsedBody.settings) {
        try {
          const clientSettings = typeof parsedBody.settings === 'string'
            ? JSON.parse(parsedBody.settings)
            : parsedBody.settings;
          newClient = clientSettings?.clients?.[0] || newClient;
        } catch (_) {}
      }

      const inbound = mockInbounds.find((ib) => ib.id === inboundId);
      if (inbound && newClient) {
        const currentSettings = JSON.parse(inbound.settings);
        currentSettings.clients.push(newClient);
        inbound.settings = JSON.stringify(currentSettings);
        inbound.clientStats = inbound.clientStats || [];
        inbound.clientStats.push({
          id: inbound.clientStats.length + 1,
          inboundId,
          enable: newClient.enable !== false,
          email: newClient.email,
          uuid: newClient.id,
          subId: newClient.subId || '',
          up: 0,
          down: 0,
          expiryTime: newClient.expiryTime || 0,
          total: newClient.totalGB || 0,
          reset: 0
        });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true, msg: 'Client added' }));
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, msg: 'Failed to add client' }));
    }

    // Route: POST /panel/api/inbounds/update/:id
    const inboundUpdateMatch = pathname.match(/^\/panel\/api\/inbounds\/update\/(\d+)$/);
    if (inboundUpdateMatch && req.method === 'POST') {
      const inboundId = Number(inboundUpdateMatch[1]);
      const targetIb = mockInbounds.find((ib) => ib.id === inboundId);
      if (targetIb) {
        if (parsedBody.total !== undefined) targetIb.total = Number(parsedBody.total);
        if (parsedBody.expiryTime !== undefined) targetIb.expiryTime = Number(parsedBody.expiryTime);
        if (parsedBody.enable !== undefined) targetIb.enable = Boolean(parsedBody.enable);
        if (parsedBody.remark !== undefined) targetIb.remark = parsedBody.remark;
        if (parsedBody.port !== undefined) targetIb.port = Number(parsedBody.port);
        if (parsedBody.listen !== undefined) targetIb.listen = parsedBody.listen;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true, msg: 'Inbound updated', obj: targetIb }));
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, msg: 'Inbound not found' }));
    }

    // Route: POST /panel/api/inbounds/:id/resetTraffic OR /panel/api/inbounds/resetTraffic/:id
    const inboundResetMatch = pathname.match(/^\/panel\/api\/inbounds\/(\d+)\/resetTraffic$/) || pathname.match(/^\/panel\/api\/inbounds\/resetTraffic\/(\d+)$/);
    if (inboundResetMatch && req.method === 'POST') {
      const inboundId = Number(inboundResetMatch[1]);
      const targetIb = mockInbounds.find((ib) => ib.id === inboundId);
      if (targetIb) {
        targetIb.up = 0;
        targetIb.down = 0;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true, msg: 'Inbound traffic reset' }));
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, msg: 'Inbound not found' }));
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
        apiKey: defaultApiKey,
        close: () => new Promise((cb) => server.close(cb))
      });
    });
  });
}

module.exports = {
  createMock3xUiServer
};
