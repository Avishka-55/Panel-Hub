const axios = require('axios');
const https = require('https');

// Create an HTTPS agent that allows self-signed certificates common in 3x-ui panels
const insecureHttpsAgent = new https.Agent({
  rejectUnauthorized: false
});

/**
 * Normalizes a panel URL by trimming trailing slashes and spaces.
 */
function normalizeUrl(url) {
  if (!url) return '';
  let cleaned = url.trim();
  while (cleaned.endsWith('/')) {
    cleaned = cleaned.slice(0, -1);
  }
  return cleaned;
}

/**
 * Logs into the 3x-ui panel and returns a cookie header string.
 */
async function authenticate(panelUrl, username, password) {
  const cleanUrl = normalizeUrl(panelUrl);
  const loginUrl = `${cleanUrl}/login`;

  try {
    const response = await axios.post(
      loginUrl,
      { username, password },
      {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'PanelHub-Admin/1.0'
        },
        httpsAgent: insecureHttpsAgent,
        timeout: 10000,
        validateStatus: (status) => status < 500
      }
    );

    if (response.status !== 200 || !response.data?.success) {
      // Some versions of x-ui accept URL-encoded form data instead of JSON
      const formParams = new URLSearchParams();
      formParams.append('username', username);
      formParams.append('password', password);

      const formResponse = await axios.post(loginUrl, formParams, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'PanelHub-Admin/1.0'
        },
        httpsAgent: insecureHttpsAgent,
        timeout: 10000,
        validateStatus: (status) => status < 500
      });

      if (formResponse.status !== 200 || !formResponse.data?.success) {
        const errorMsg = formResponse.data?.msg || response.data?.msg || 'Invalid panel username or password';
        throw new Error(`Authentication failed on 3x-ui panel: ${errorMsg}`);
      }

      return extractCookies(formResponse.headers['set-cookie']);
    }

    return extractCookies(response.headers['set-cookie']);
  } catch (error) {
    if (error.response?.data?.msg) {
      throw new Error(`3x-ui login rejected: ${error.response.data.msg}`);
    }
    if (error.code === 'ECONNREFUSED') {
      throw new Error(`Connection refused at ${cleanUrl}. Check IP and port.`);
    }
    if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
      throw new Error(`Connection to 3x-ui panel timed out at ${cleanUrl}.`);
    }
    throw new Error(error.message || 'Failed to authenticate with 3x-ui panel');
  }
}

/**
 * Extracts and formats cookie string from set-cookie headers.
 */
function extractCookies(setCookieHeader) {
  if (!setCookieHeader) return '';
  const cookies = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
  return cookies.map((c) => c.split(';')[0]).join('; ');
}

/**
 * Creates an authenticated Axios instance for communicating with a panel.
 */
function createPanelClient(panelUrl, cookieHeader) {
  const cleanUrl = normalizeUrl(panelUrl);
  return axios.create({
    baseURL: cleanUrl,
    headers: {
      Cookie: cookieHeader,
      'Content-Type': 'application/json',
      'User-Agent': 'PanelHub-Admin/1.0'
    },
    httpsAgent: insecureHttpsAgent,
    timeout: 15000
  });
}

/**
 * Tests connection to a 3x-ui panel.
 */
async function testConnection(panelUrl, username, password) {
  const cookie = await authenticate(panelUrl, username, password);
  const client = createPanelClient(panelUrl, cookie);

  const response = await client.get('/panel/api/inbounds/list');
  if (!response.data?.success) {
    throw new Error(response.data?.msg || 'Failed to retrieve inbounds list from panel');
  }

  const inbounds = response.data.obj || [];
  return {
    success: true,
    inboundCount: inbounds.length
  };
}

/**
 * Fetches all inbounds from a 3x-ui panel.
 */
async function getInbounds(panelUrl, username, password) {
  const cookie = await authenticate(panelUrl, username, password);
  const client = createPanelClient(panelUrl, cookie);

  const response = await client.get('/panel/api/inbounds/list');
  if (!response.data?.success) {
    throw new Error(response.data?.msg || 'Failed to retrieve inbounds from 3x-ui panel');
  }

  const rawInbounds = response.data.obj || [];
  return rawInbounds.map((inbound) => {
    let clientsCount = 0;
    try {
      if (inbound.settings) {
        const parsedSettings = typeof inbound.settings === 'string'
          ? JSON.parse(inbound.settings)
          : inbound.settings;
        if (Array.isArray(parsedSettings.clients)) {
          clientsCount = parsedSettings.clients.length;
        }
      }
    } catch (_) {}

    return {
      id: inbound.id,
      remark: inbound.remark || `Inbound-${inbound.id}`,
      protocol: inbound.protocol,
      port: inbound.port,
      listen: inbound.listen || '0.0.0.0',
      enable: Boolean(inbound.enable),
      up: inbound.up || 0,
      down: inbound.down || 0,
      total: inbound.total || 0,
      expiryTime: inbound.expiryTime || 0,
      tag: inbound.tag || '',
      clientCount: clientsCount,
      clientStats: inbound.clientStats || []
    };
  });
}

/**
 * Fetches clients for a specific inbound live from the 3x-ui panel.
 */
async function getInboundClients(panelUrl, username, password, inboundId) {
  const cookie = await authenticate(panelUrl, username, password);
  const client = createPanelClient(panelUrl, cookie);

  // Fetch inbounds to locate the specific inbound and its client settings
  const response = await client.get('/panel/api/inbounds/list');
  if (!response.data?.success) {
    throw new Error(response.data?.msg || 'Failed to retrieve inbounds list');
  }

  const inbounds = response.data.obj || [];
  const targetInbound = inbounds.find((ib) => String(ib.id) === String(inboundId));

  if (!targetInbound) {
    throw new Error(`Inbound with ID "${inboundId}" not found on this 3x-ui panel`);
  }

  // Parse settings to get clients list
  let clients = [];
  try {
    const parsedSettings = typeof targetInbound.settings === 'string'
      ? JSON.parse(targetInbound.settings)
      : targetInbound.settings;
    if (Array.isArray(parsedSettings.clients)) {
      clients = parsedSettings.clients;
    }
  } catch (err) {
    throw new Error(`Failed to parse inbound settings: ${err.message}`);
  }

  // Extract client stats from inbound (clientStats array)
  const clientStats = targetInbound.clientStats || [];
  const statsMap = new Map();
  for (const stat of clientStats) {
    if (stat.email) statsMap.set(stat.email, stat);
    if (stat.id) statsMap.set(String(stat.id), stat);
  }

  return clients.map((c) => {
    const stat = statsMap.get(c.email) || statsMap.get(String(c.id)) || {};
    return {
      id: c.id || c.password || c.email, // VMESS/VLESS uses UUID id, Trojan uses password, Shadowsocks uses email
      email: c.email || 'unnamed',
      enable: c.enable !== undefined ? Boolean(c.enable) : true,
      totalGB: c.totalGB !== undefined ? c.totalGB : (stat.total || 0),
      expiryTime: c.expiryTime !== undefined ? c.expiryTime : (stat.expiryTime || 0),
      up: stat.up || 0,
      down: stat.down || 0,
      subId: c.subId || '',
      limitIp: c.limitIp || 0,
      flow: c.flow || '',
      inboundId: targetInbound.id,
      inboundRemark: targetInbound.remark,
      protocol: targetInbound.protocol
    };
  });
}

/**
 * Finds an inbound containing the specified clientId across all inbounds.
 */
async function findClientAcrossInbounds(panelClient, clientId) {
  const response = await panelClient.get('/panel/api/inbounds/list');
  if (!response.data?.success) {
    throw new Error('Failed to retrieve inbounds list to search for client');
  }

  const inbounds = response.data.obj || [];
  for (const inbound of inbounds) {
    try {
      const parsedSettings = typeof inbound.settings === 'string'
        ? JSON.parse(inbound.settings)
        : inbound.settings;
      if (Array.isArray(parsedSettings.clients)) {
        const found = parsedSettings.clients.find(
          (c) => String(c.id) === String(clientId) ||
                 String(c.password) === String(clientId) ||
                 String(c.email) === String(clientId)
        );
        if (found) {
          return { inbound, client: found };
        }
      }
    } catch (_) {}
  }
  return null;
}

/**
 * Updates client expiry, bandwidth quota (totalGB), or enabled status.
 */
async function updateClient(panelUrl, username, password, clientId, updateData) {
  const cookie = await authenticate(panelUrl, username, password);
  const client = createPanelClient(panelUrl, cookie);

  let inboundId = updateData.inboundId;
  let targetClient = null;

  // If inboundId is not directly passed, locate client across inbounds
  const located = await findClientAcrossInbounds(client, clientId);
  if (!located) {
    throw new Error(`Client "${clientId}" not found on this panel`);
  }

  inboundId = located.inbound.id;
  targetClient = located.client;

  // Merge updated values
  const updatedClientPayload = {
    ...targetClient,
    id: targetClient.id || clientId,
    email: updateData.email !== undefined ? updateData.email : targetClient.email,
    enable: updateData.enable !== undefined ? Boolean(updateData.enable) : Boolean(targetClient.enable),
    totalGB: updateData.totalGB !== undefined ? Number(updateData.totalGB) : (targetClient.totalGB || 0),
    expiryTime: updateData.expiryTime !== undefined ? Number(updateData.expiryTime) : (targetClient.expiryTime || 0)
  };

  const payload = {
    id: inboundId,
    settings: JSON.stringify({
      clients: [updatedClientPayload]
    })
  };

  const response = await client.post(`/panel/api/inbounds/updateClient/${clientId}`, payload);
  if (!response.data?.success) {
    throw new Error(response.data?.msg || 'Failed to update client on 3x-ui panel');
  }

  return {
    success: true,
    client: updatedClientPayload
  };
}

/**
 * Deletes a client from an inbound.
 */
async function deleteClient(panelUrl, username, password, clientId, inboundId) {
  const cookie = await authenticate(panelUrl, username, password);
  const client = createPanelClient(panelUrl, cookie);

  let resolvedInboundId = inboundId;
  if (!resolvedInboundId) {
    const located = await findClientAcrossInbounds(client, clientId);
    if (!located) {
      throw new Error(`Client "${clientId}" not found on this panel`);
    }
    resolvedInboundId = located.inbound.id;
  }

  // 3x-ui primary endpoint: POST /panel/api/inbounds/:inboundId/delClient/:clientId
  try {
    const response = await client.post(`/panel/api/inbounds/${resolvedInboundId}/delClient/${clientId}`);
    if (response.data?.success) {
      return { success: true };
    }
  } catch (err) {
    // Try alternative route if 404
    if (err.response?.status === 404) {
      const altResponse = await client.post(`/panel/api/inbounds/delClient/${clientId}`);
      if (altResponse.data?.success) {
        return { success: true };
      }
    }
    throw new Error(err.response?.data?.msg || err.message || 'Failed to delete client');
  }

  return { success: true };
}

/**
 * Resets client traffic counters.
 */
async function resetClientTraffic(panelUrl, username, password, clientId, inboundId) {
  const cookie = await authenticate(panelUrl, username, password);
  const client = createPanelClient(panelUrl, cookie);

  let resolvedInboundId = inboundId;
  let clientEmail = null;

  const located = await findClientAcrossInbounds(client, clientId);
  if (located) {
    resolvedInboundId = located.inbound.id;
    clientEmail = located.client.email;
  } else if (!clientEmail) {
    clientEmail = clientId; // In shadowsocks or if email was passed as clientId
  }

  if (!clientEmail) {
    throw new Error(`Cannot reset traffic: unable to resolve client email for "${clientId}"`);
  }

  // 3x-ui endpoint: POST /panel/api/inbounds/:inboundId/resetClientTraffic/:email
  try {
    const response = await client.post(
      `/panel/api/inbounds/${resolvedInboundId}/resetClientTraffic/${encodeURIComponent(clientEmail)}`
    );
    if (response.data?.success) {
      return { success: true, email: clientEmail };
    }
    throw new Error(response.data?.msg || 'Failed to reset client traffic');
  } catch (err) {
    // Some 3x-ui versions support /panel/api/inbounds/resetClientTraffic/:email
    try {
      const altResponse = await client.post(
        `/panel/api/inbounds/resetClientTraffic/${encodeURIComponent(clientEmail)}`
      );
      if (altResponse.data?.success) {
        return { success: true, email: clientEmail };
      }
    } catch (_) {}
    throw new Error(err.response?.data?.msg || err.message || 'Failed to reset client traffic');
  }
}

/**
 * Adds a new client to an inbound.
 */
async function addClient(panelUrl, username, password, inboundId, clientData) {
  const cookie = await authenticate(panelUrl, username, password);
  const client = createPanelClient(panelUrl, cookie);

  const payload = {
    id: Number(inboundId),
    settings: JSON.stringify({
      clients: [clientData]
    })
  };

  const response = await client.post('/panel/api/inbounds/addClient', payload);
  if (!response.data?.success) {
    throw new Error(response.data?.msg || 'Failed to add client to inbound');
  }

  return { success: true, client: clientData };
}

module.exports = {
  authenticate,
  testConnection,
  getInbounds,
  getInboundClients,
  updateClient,
  deleteClient,
  resetClientTraffic,
  addClient
};
