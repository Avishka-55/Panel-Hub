const axios = require('axios');
const https = require('https');

// Create an HTTPS agent that allows self-signed certificates common in 3x-ui panels
const insecureHttpsAgent = new https.Agent({
  rejectUnauthorized: false
});

/**
 * Normalizes panel URL, ensuring trailing slash for base-path compatibility.
 */
function normalizePanelUrl(url) {
  if (!url) return '';
  let cleaned = url.trim();
  if (!cleaned.endsWith('/')) {
    cleaned += '/';
  }
  return cleaned;
}

/**
 * Merges cookie strings, giving precedence to newer cookies for the same key.
 */
function mergeCookies(existingCookieStr = '', newSetCookieHeader = []) {
  const cookieMap = new Map();

  if (existingCookieStr) {
    existingCookieStr.split(';').forEach((part) => {
      const trimmed = part.trim();
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        cookieMap.set(trimmed.slice(0, eqIdx), trimmed);
      }
    });
  }

  if (newSetCookieHeader) {
    const arr = Array.isArray(newSetCookieHeader) ? newSetCookieHeader : [newSetCookieHeader];
    arr.forEach((headerVal) => {
      const cookiePart = headerVal.split(';')[0].trim();
      const eqIdx = cookiePart.indexOf('=');
      if (eqIdx !== -1) {
        cookieMap.set(cookiePart.slice(0, eqIdx), cookiePart);
      }
    });
  }

  return Array.from(cookieMap.values()).join('; ');
}

/**
 * Performs full CSRF-aware, subpath-aware authentication against 3x-ui panels.
 */
async function authenticate(panelUrl, username, password) {
  const base = normalizePanelUrl(panelUrl);

  let initialCookie = '';
  let csrfToken = '';

  // 1. Fetch initial landing page to capture session cookies and CSRF meta token
  try {
    const initRes = await axios.get(base, {
      httpsAgent: insecureHttpsAgent,
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      validateStatus: () => true
    });

    initialCookie = mergeCookies('', initRes.headers['set-cookie']);

    if (typeof initRes.data === 'string') {
      const match = initRes.data.match(/name="csrf-token" content="([^"]+)"/);
      if (match) {
        csrfToken = match[1];
      }
    }
  } catch (err) {
    console.warn(`[3x-ui initial probe warning]: ${err.message}`);
  }

  // If CSRF token wasn't in HTML meta, try /csrf-token endpoint
  if (!csrfToken && initialCookie) {
    try {
      const csrfRes = await axios.get(`${base}csrf-token`, {
        httpsAgent: insecureHttpsAgent,
        timeout: 5000,
        headers: {
          Cookie: initialCookie,
          'X-Requested-With': 'XMLHttpRequest'
        },
        validateStatus: () => true
      });
      if (csrfRes.data?.success && typeof csrfRes.data.obj === 'string') {
        csrfToken = csrfRes.data.obj;
      }
    } catch (_) {}
  }

  // 2. Perform Login POST
  // Strategy A: URL-encoded with CSRF token (Standard in newer 3x-ui)
  const formParams = new URLSearchParams();
  formParams.append('username', username);
  formParams.append('password', password);
  formParams.append('twoFactorCode', '');

  const headersA = {
    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    'X-Requested-With': 'XMLHttpRequest',
    'User-Agent': 'PanelHub-Admin/1.0'
  };
  if (initialCookie) headersA['Cookie'] = initialCookie;
  if (csrfToken) headersA['X-CSRF-Token'] = csrfToken;

  try {
    const loginRes = await axios.post(`${base}login`, formParams.toString(), {
      headers: headersA,
      httpsAgent: insecureHttpsAgent,
      timeout: 12000,
      validateStatus: () => true
    });

    if (loginRes.status === 200 && loginRes.data?.success) {
      const finalCookie = mergeCookies(initialCookie, loginRes.headers['set-cookie']);
      return {
        base,
        cookieHeader: finalCookie,
        csrfToken
      };
    }

    if (loginRes.data && loginRes.data.success === false && loginRes.data.msg) {
      throw new Error(`Authentication failed on 3x-ui panel: ${loginRes.data.msg}`);
    }

    // Strategy B: JSON POST (standard in older 3x-ui versions or root login)
    const headersB = {
      'Content-Type': 'application/json',
      'User-Agent': 'PanelHub-Admin/1.0'
    };
    if (initialCookie) headersB['Cookie'] = initialCookie;
    if (csrfToken) headersB['X-CSRF-Token'] = csrfToken;

    const jsonRes = await axios.post(
      `${base}login`,
      { username, password },
      {
        headers: headersB,
        httpsAgent: insecureHttpsAgent,
        timeout: 12000,
        validateStatus: () => true
      }
    );

    if (jsonRes.status === 200 && jsonRes.data?.success) {
      const finalCookie = mergeCookies(initialCookie, jsonRes.headers['set-cookie']);
      return {
        base,
        cookieHeader: finalCookie,
        csrfToken
      };
    }

    const errorMsg = jsonRes.data?.msg || loginRes.data?.msg || 'Invalid panel username or password';
    throw new Error(`Authentication failed on 3x-ui panel: ${errorMsg}`);
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      throw new Error(`Connection refused at ${base}. Please check IP and port.`);
    }
    if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
      throw new Error(`Connection to 3x-ui panel timed out at ${base}.`);
    }
    throw error;
  }
}

/**
 * Creates authenticated Axios instance for subsequent API queries.
 */
function createClient(authContext) {
  const { base, cookieHeader, csrfToken } = authContext;
  const headers = {
    Cookie: cookieHeader,
    'X-Requested-With': 'XMLHttpRequest',
    'User-Agent': 'PanelHub-Admin/1.0',
    'Content-Type': 'application/json'
  };
  if (csrfToken) {
    headers['X-CSRF-Token'] = csrfToken;
  }

  return {
    client: axios.create({
      baseURL: base,
      headers,
      httpsAgent: insecureHttpsAgent,
      timeout: 15000
    }),
    base
  };
}

/**
 * Tests live connection to 3x-ui panel.
 */
async function testConnection(panelUrl, username, password) {
  const authContext = await authenticate(panelUrl, username, password);
  const { client } = createClient(authContext);

  const response = await client.get('panel/api/inbounds/list');
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
 * Fetches all inbounds live from 3x-ui panel.
 */
async function getInbounds(panelUrl, username, password) {
  const authContext = await authenticate(panelUrl, username, password);
  const { client } = createClient(authContext);

  const response = await client.get('panel/api/inbounds/list');
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
  const authContext = await authenticate(panelUrl, username, password);
  const { client } = createClient(authContext);

  const response = await client.get('panel/api/inbounds/list');
  if (!response.data?.success) {
    throw new Error(response.data?.msg || 'Failed to retrieve inbounds list');
  }

  const inbounds = response.data.obj || [];
  const targetInbound = inbounds.find((ib) => String(ib.id) === String(inboundId));

  if (!targetInbound) {
    throw new Error(`Inbound with ID "${inboundId}" not found on this 3x-ui panel`);
  }

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

  const clientStats = targetInbound.clientStats || [];
  const statsMap = new Map();
  for (const stat of clientStats) {
    if (stat.email) statsMap.set(stat.email, stat);
    if (stat.id) statsMap.set(String(stat.id), stat);
  }

  return clients.map((c) => {
    const stat = statsMap.get(c.email) || statsMap.get(String(c.id)) || {};
    return {
      id: c.id || c.password || c.email,
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
  const response = await panelClient.get('panel/api/inbounds/list');
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
 * Updates client expiry, bandwidth quota (totalGB), or enabled status live.
 * Supports both modern 3x-ui (/panel/api/clients/update/:email) and classic (/panel/api/inbounds/updateClient/:clientId).
 */
async function updateClient(panelUrl, username, password, clientId, updateData) {
  const authContext = await authenticate(panelUrl, username, password);
  const { client } = createClient(authContext);

  let inboundId = updateData.inboundId;
  let targetClient = null;

  const located = await findClientAcrossInbounds(client, clientId);
  if (!located) {
    throw new Error(`Client "${clientId}" not found on this panel`);
  }

  inboundId = located.inbound.id;
  targetClient = located.client;

  // Normalize data types for Go struct unmarshaling
  const updatedClientPayload = {
    ...targetClient,
    id: targetClient.id || clientId,
    email: updateData.email !== undefined ? updateData.email : targetClient.email,
    enable: updateData.enable !== undefined ? Boolean(updateData.enable) : Boolean(targetClient.enable),
    totalGB: updateData.totalGB !== undefined ? Number(updateData.totalGB) : (Number(targetClient.totalGB) || 0),
    expiryTime: updateData.expiryTime !== undefined ? Number(updateData.expiryTime) : (Number(targetClient.expiryTime) || 0),
    limitIp: Number(targetClient.limitIp) || 0,
    tgId: typeof targetClient.tgId === 'string' ? (Number(targetClient.tgId) || 0) : (targetClient.tgId || 0)
  };

  const clientIdentifier = targetClient.email || clientId;

  // Try Strategy 1: Modern 3x-ui endpoint POST /panel/api/clients/update/:email
  try {
    const modernRes = await client.post(`panel/api/clients/update/${encodeURIComponent(clientIdentifier)}`, updatedClientPayload);
    if (modernRes.data?.success) {
      return { success: true, client: updatedClientPayload };
    }
    if (modernRes.data?.msg) {
      throw new Error(modernRes.data.msg);
    }
  } catch (err) {
    // If not a 404, throw the error directly
    if (err.response && err.response.status !== 404) {
      throw new Error(err.response.data?.msg || err.message);
    }
  }

  // Try Strategy 2: Classic 3x-ui endpoint POST /panel/api/inbounds/updateClient/:clientId
  const payload = {
    id: inboundId,
    settings: JSON.stringify({
      clients: [updatedClientPayload]
    })
  };

  const response = await client.post(`panel/api/inbounds/updateClient/${encodeURIComponent(clientId)}`, payload);
  if (!response.data?.success) {
    throw new Error(response.data?.msg || 'Failed to update client on 3x-ui panel');
  }

  return {
    success: true,
    client: updatedClientPayload
  };
}

/**
 * Deletes a client from an inbound live.
 * Supports both modern 3x-ui (/panel/api/clients/del/:email) and classic.
 */
async function deleteClient(panelUrl, username, password, clientId, inboundId) {
  const authContext = await authenticate(panelUrl, username, password);
  const { client } = createClient(authContext);

  let resolvedInboundId = inboundId;
  let clientEmail = null;

  const located = await findClientAcrossInbounds(client, clientId);
  if (located) {
    resolvedInboundId = located.inbound.id;
    clientEmail = located.client.email;
  }

  const clientIdentifier = clientEmail || clientId;

  // Try Strategy 1: Modern 3x-ui POST /panel/api/clients/del/:email
  try {
    const modernRes = await client.post(`panel/api/clients/del/${encodeURIComponent(clientIdentifier)}`);
    if (modernRes.data?.success) {
      return { success: true };
    }
  } catch (err) {
    if (err.response && err.response.status !== 404) {
      throw new Error(err.response.data?.msg || err.message);
    }
  }

  // Try Strategy 2: Classic 3x-ui POST /panel/api/inbounds/:inboundId/delClient/:clientId
  try {
    const response = await client.post(`panel/api/inbounds/${resolvedInboundId}/delClient/${clientId}`);
    if (response.data?.success) {
      return { success: true };
    }
  } catch (err) {
    if (err.response?.status === 404) {
      const altResponse = await client.post(`panel/api/inbounds/delClient/${clientId}`);
      if (altResponse.data?.success) {
        return { success: true };
      }
    }
    throw new Error(err.response?.data?.msg || err.message || 'Failed to delete client');
  }

  return { success: true };
}

/**
 * Resets client traffic counters live.
 * Supports both modern 3x-ui (/panel/api/clients/resetTraffic/:email) and classic.
 */
async function resetClientTraffic(panelUrl, username, password, clientId, inboundId) {
  const authContext = await authenticate(panelUrl, username, password);
  const { client } = createClient(authContext);

  let resolvedInboundId = inboundId;
  let clientEmail = null;

  const located = await findClientAcrossInbounds(client, clientId);
  if (located) {
    resolvedInboundId = located.inbound.id;
    clientEmail = located.client.email;
  } else if (!clientEmail) {
    clientEmail = clientId;
  }

  const clientIdentifier = clientEmail || clientId;

  // Try Strategy 1: Modern 3x-ui POST /panel/api/clients/resetTraffic/:email
  try {
    const modernRes = await client.post(`panel/api/clients/resetTraffic/${encodeURIComponent(clientIdentifier)}`, {});
    if (modernRes.data?.success) {
      return { success: true, email: clientIdentifier };
    }
  } catch (err) {
    if (err.response && err.response.status !== 404) {
      throw new Error(err.response.data?.msg || err.message);
    }
  }

  // Try Strategy 2: Classic 3x-ui POST /panel/api/inbounds/:inboundId/resetClientTraffic/:email
  try {
    const response = await client.post(
      `panel/api/inbounds/${resolvedInboundId}/resetClientTraffic/${encodeURIComponent(clientIdentifier)}`
    );
    if (response.data?.success) {
      return { success: true, email: clientIdentifier };
    }
    throw new Error(response.data?.msg || 'Failed to reset client traffic');
  } catch (err) {
    try {
      const altResponse = await client.post(
        `panel/api/inbounds/resetClientTraffic/${encodeURIComponent(clientIdentifier)}`
      );
      if (altResponse.data?.success) {
        return { success: true, email: clientIdentifier };
      }
    } catch (_) {}
    throw new Error(err.response?.data?.msg || err.message || 'Failed to reset client traffic');
  }
}

/**
 * Adds a new client to an inbound live.
 */
async function addClient(panelUrl, username, password, inboundId, clientData) {
  const authContext = await authenticate(panelUrl, username, password);
  const { client } = createClient(authContext);

  const normalizedClient = {
    ...clientData,
    limitIp: Number(clientData.limitIp) || 0,
    totalGB: Number(clientData.totalGB) || 0,
    expiryTime: Number(clientData.expiryTime) || 0,
    tgId: 0,
    inboundId: Number(inboundId)
  };

  // Try Strategy 1: Modern 3x-ui POST /panel/api/clients/add
  try {
    const modernRes = await client.post('panel/api/clients/add', normalizedClient);
    if (modernRes.data?.success) {
      return { success: true, client: normalizedClient };
    }
  } catch (err) {
    if (err.response && err.response.status !== 404) {
      throw new Error(err.response.data?.msg || err.message);
    }
  }

  // Try Strategy 2: Classic 3x-ui POST /panel/api/inbounds/addClient
  const payload = {
    id: Number(inboundId),
    settings: JSON.stringify({
      clients: [normalizedClient]
    })
  };

  const response = await client.post('panel/api/inbounds/addClient', payload);
  if (!response.data?.success) {
    throw new Error(response.data?.msg || 'Failed to add client to inbound');
  }

  return { success: true, client: normalizedClient };
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
