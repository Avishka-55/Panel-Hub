const axios = require('axios');
const https = require('https');
const crypto = require('crypto');
const { generateClientLinks } = require('../utils/linkGenerator');

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
 * Performs full CSRF-aware, subpath-aware authentication against 3x-ui panels using username/password.
 */
async function authenticateWithCredentials(panelUrl, username, password) {
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
 * Normalizes input auth parameters into an object: { apiKey } OR { username, password }
 */
function resolveAuthConfig(authConfigOrUsername, password) {
  if (typeof authConfigOrUsername === 'object' && authConfigOrUsername !== null) {
    return authConfigOrUsername;
  }
  return { username: authConfigOrUsername, password };
}

/**
 * Obtains an authenticated Axios instance supporting both API Token and Username/Password modes.
 */
async function getAuthenticatedClient(panelUrl, authConfig) {
  const base = normalizePanelUrl(panelUrl);

  // Strategy 1: Direct API Token Authentication (Sessionless & Fast)
  if (authConfig.apiKey) {
    const headers = {
      Authorization: `Bearer ${authConfig.apiKey.trim()}`,
      'User-Agent': 'PanelHub-Admin/1.0',
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest'
    };
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

  // Strategy 2: Web Session Cookie Authentication (Username & Password)
  const authContext = await authenticateWithCredentials(panelUrl, authConfig.username, authConfig.password);
  const headers = {
    Cookie: authContext.cookieHeader,
    'X-Requested-With': 'XMLHttpRequest',
    'User-Agent': 'PanelHub-Admin/1.0',
    'Content-Type': 'application/json'
  };
  if (authContext.csrfToken) {
    headers['X-CSRF-Token'] = authContext.csrfToken;
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
async function testConnection(panelUrl, authConfigOrUsername, password) {
  const authConfig = resolveAuthConfig(authConfigOrUsername, password);
  const { client } = await getAuthenticatedClient(panelUrl, authConfig);

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
async function getInbounds(panelUrl, authConfigOrUsername, password) {
  const authConfig = resolveAuthConfig(authConfigOrUsername, password);
  const { client } = await getAuthenticatedClient(panelUrl, authConfig);

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
      clientStats: inbound.clientStats || [],
      settings: inbound.settings,
      streamSettings: inbound.streamSettings,
      sniffing: inbound.sniffing
    };
  });
}

/**
 * Fetches clients for a specific inbound live from the 3x-ui panel.
 */
async function getInboundClients(panelUrl, authConfigOrUsername, passwordOrInboundId, maybeInboundId) {
  let authConfig;
  let inboundId;

  if (typeof authConfigOrUsername === 'object' && authConfigOrUsername !== null) {
    authConfig = authConfigOrUsername;
    inboundId = passwordOrInboundId;
  } else {
    authConfig = { username: authConfigOrUsername, password: passwordOrInboundId };
    inboundId = maybeInboundId;
  }

  const { client } = await getAuthenticatedClient(panelUrl, authConfig);

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

  // Probe 3x-ui for currently online clients using candidate endpoints
  const onlineClientSet = new Set();
  const probeEndpoints = [
    { method: 'post', url: 'panel/api/inbounds/onlines', data: {} },
    { method: 'get', url: 'panel/api/inbounds/onlines' },
    { method: 'post', url: 'panel/api/clients/onlines', data: {} },
    { method: 'get', url: 'panel/api/clients/onlines' }
  ];

  for (const probe of probeEndpoints) {
    try {
      const res = probe.method === 'post'
        ? await client.post(probe.url, probe.data || {})
        : await client.get(probe.url);

      const raw = res?.data?.obj !== undefined ? res.data.obj : res?.data;
      if (raw) {
        const countBefore = onlineClientSet.size;
        if (Array.isArray(raw)) {
          raw.forEach((item) => {
            if (typeof item === 'string') {
              onlineClientSet.add(item.trim().toLowerCase());
            } else if (item && typeof item === 'object') {
              if (item.email) onlineClientSet.add(String(item.email).trim().toLowerCase());
              if (item.id) onlineClientSet.add(String(item.id).trim().toLowerCase());
            }
          });
        } else if (typeof raw === 'object' && raw !== null) {
          Object.keys(raw).forEach((key) => {
            if (key) onlineClientSet.add(String(key).trim().toLowerCase());
          });
        }
        if (onlineClientSet.size > countBefore) {
          console.log(`[3x-ui Online Probe] Succeeded via ${probe.method.toUpperCase()} ${probe.url}:`, Array.from(onlineClientSet));
          break;
        }
      }
    } catch (_) {
      // Continue to next candidate endpoint
    }
  }

  // Probe 3x-ui for last online timestamps
  const lastOnlineMap = new Map();
  const lastOnlineEndpoints = [
    { method: 'post', url: 'panel/api/inbounds/lastOnline', data: {} },
    { method: 'get', url: 'panel/api/inbounds/lastOnline' },
    { method: 'post', url: 'panel/api/clients/lastOnline', data: {} },
    { method: 'get', url: 'panel/api/clients/lastOnline' }
  ];

  for (const probe of lastOnlineEndpoints) {
    try {
      const res = probe.method === 'post'
        ? await client.post(probe.url, probe.data || {})
        : await client.get(probe.url);

      const raw = res?.data?.obj !== undefined ? res.data.obj : res?.data;
      if (raw) {
        if (Array.isArray(raw)) {
          raw.forEach((item) => {
            if (item && item.email && item.time) {
              lastOnlineMap.set(String(item.email).trim().toLowerCase(), Number(item.time));
            }
          });
        } else if (typeof raw === 'object' && raw !== null) {
          Object.entries(raw).forEach(([k, v]) => {
            if (v) lastOnlineMap.set(String(k).trim().toLowerCase(), Number(v));
          });
        }
        if (lastOnlineMap.size > 0) break;
      }
    } catch (_) {}
  }

  console.log(`[3x-ui Clients Status] Inbound "${targetInbound.remark}": ${clients.length} clients registered. Online detected: ${onlineClientSet.size}`);

  return clients.map((c) => {
    const stat = statsMap.get(c.email) || statsMap.get(String(c.id)) || {};
    const links = generateClientLinks(c, targetInbound, panelUrl);
    const clientEmail = (c.email || '').trim().toLowerCase();
    const clientIdStr = String(c.id || '').trim().toLowerCase();
    const clientPassStr = String(c.password || '').trim().toLowerCase();

    // Check direct online indicators embedded by some 3x-ui forks in client or stat
    const directOnline = Boolean(c.online || c.isOnline || stat.online || stat.isOnline);

    // Check online set matches (by email, id, password, or email prefix)
    let probedOnline = onlineClientSet.has(clientEmail) ||
      (clientIdStr && onlineClientSet.has(clientIdStr)) ||
      (clientPassStr && onlineClientSet.has(clientPassStr));

    if (!probedOnline && clientEmail) {
      for (const onlineItem of onlineClientSet) {
        if (
          onlineItem === clientEmail ||
          onlineItem === clientIdStr ||
          clientEmail.startsWith(onlineItem + '@') ||
          onlineItem.startsWith(clientEmail + '@')
        ) {
          probedOnline = true;
          break;
        }
      }
    }

    const isOnline = directOnline || probedOnline;
    const lastOnline = c.lastOnline || stat.lastOnline || lastOnlineMap.get(clientEmail) || lastOnlineMap.get(clientIdStr) || null;

    return {
      id: c.id || c.password || c.email,
      email: c.email || 'unnamed',
      enable: c.enable !== undefined ? Boolean(c.enable) : true,
      isOnline: Boolean(isOnline),
      lastOnline,
      totalGB: c.totalGB !== undefined ? c.totalGB : (stat.total || 0),
      expiryTime: c.expiryTime !== undefined ? c.expiryTime : (stat.expiryTime || 0),
      up: stat.up || 0,
      down: stat.down || 0,
      subId: c.subId || '',
      limitIp: c.limitIp || 0,
      flow: c.flow || '',
      inboundId: targetInbound.id,
      inboundRemark: targetInbound.remark,
      protocol: targetInbound.protocol,
      port: targetInbound.port,
      streamSettings: typeof targetInbound.streamSettings === 'string'
        ? JSON.parse(targetInbound.streamSettings || '{}')
        : targetInbound.streamSettings,
      link: links.v2rayLink,
      subUrl: links.subUrl,
      host: links.host
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
 */
async function updateClient(panelUrl, authConfigOrUsername, passwordOrClientId, clientIdOrUpdateData, maybeUpdateData) {
  let authConfig;
  let clientId;
  let updateData;

  if (typeof authConfigOrUsername === 'object' && authConfigOrUsername !== null) {
    authConfig = authConfigOrUsername;
    clientId = passwordOrClientId;
    updateData = clientIdOrUpdateData;
  } else {
    authConfig = { username: authConfigOrUsername, password: passwordOrClientId };
    clientId = clientIdOrUpdateData;
    updateData = maybeUpdateData;
  }

  const { client } = await getAuthenticatedClient(panelUrl, authConfig);

  let inboundId = updateData.inboundId;
  let targetClient = null;

  const located = await findClientAcrossInbounds(client, clientId);
  if (!located) {
    throw new Error(`Client "${clientId}" not found on this panel`);
  }

  inboundId = located.inbound.id;
  targetClient = located.client;

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

  // Strategy 1: Modern 3x-ui endpoint POST /panel/api/clients/update/:email
  try {
    const modernRes = await client.post(`panel/api/clients/update/${encodeURIComponent(clientIdentifier)}`, updatedClientPayload);
    if (modernRes.data?.success) {
      return { success: true, client: updatedClientPayload };
    }
    if (modernRes.data?.msg) {
      throw new Error(modernRes.data.msg);
    }
  } catch (err) {
    if (err.response && err.response.status !== 404) {
      throw new Error(err.response.data?.msg || err.message);
    }
  }

  // Strategy 2: Classic 3x-ui endpoint POST /panel/api/inbounds/updateClient/:clientId
  const payload = {
    id: inboundId,
    settings: JSON.stringify({
      clients: [updatedClientPayload]
    })
  };

  const clientKey = targetClient.id || clientId;
  const response = await client.post(`panel/api/inbounds/updateClient/${encodeURIComponent(clientKey)}`, payload);
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
 */
async function deleteClient(panelUrl, authConfigOrUsername, passwordOrClientId, clientIdOrInboundId, maybeInboundId) {
  let authConfig;
  let clientId;
  let inboundId;

  if (typeof authConfigOrUsername === 'object' && authConfigOrUsername !== null) {
    authConfig = authConfigOrUsername;
    clientId = passwordOrClientId;
    inboundId = clientIdOrInboundId;
  } else {
    authConfig = { username: authConfigOrUsername, password: passwordOrClientId };
    clientId = clientIdOrInboundId;
    inboundId = maybeInboundId;
  }

  const { client } = await getAuthenticatedClient(panelUrl, authConfig);

  let resolvedInboundId = inboundId;
  let clientEmail = null;

  const located = await findClientAcrossInbounds(client, clientId);
  if (located) {
    resolvedInboundId = located.inbound.id;
    clientEmail = located.client.email;
  }

  const clientIdentifier = clientEmail || clientId;

  // Strategy 1: Modern 3x-ui POST /panel/api/clients/del/:email
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

  // Strategy 2: Classic 3x-ui POST /panel/api/inbounds/:inboundId/delClient/:clientId
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
 */
async function resetClientTraffic(panelUrl, authConfigOrUsername, passwordOrClientId, clientIdOrInboundId, maybeInboundId) {
  let authConfig;
  let clientId;
  let inboundId;

  if (typeof authConfigOrUsername === 'object' && authConfigOrUsername !== null) {
    authConfig = authConfigOrUsername;
    clientId = passwordOrClientId;
    inboundId = clientIdOrInboundId;
  } else {
    authConfig = { username: authConfigOrUsername, password: passwordOrClientId };
    clientId = clientIdOrInboundId;
    inboundId = maybeInboundId;
  }

  const { client } = await getAuthenticatedClient(panelUrl, authConfig);

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

  // Strategy 1: Modern 3x-ui POST /panel/api/clients/resetTraffic/:email
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

  // Strategy 2: Classic 3x-ui POST /panel/api/inbounds/:inboundId/resetClientTraffic/:email
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
async function addClient(panelUrl, authConfigOrUsername, passwordOrInboundId, inboundIdOrClientData, maybeClientData) {
  let authConfig;
  let inboundId;
  let clientData;

  if (typeof authConfigOrUsername === 'object' && authConfigOrUsername !== null) {
    authConfig = authConfigOrUsername;
    inboundId = passwordOrInboundId;
    clientData = inboundIdOrClientData;
  } else {
    authConfig = { username: authConfigOrUsername, password: passwordOrInboundId };
    inboundId = inboundIdOrClientData;
    clientData = maybeClientData;
  }

  const { client } = await getAuthenticatedClient(panelUrl, authConfig);

  const clientObj = {
    id: clientData.id || crypto.randomUUID(),
    email: clientData.email,
    subId: clientData.subId || crypto.randomBytes(8).toString('hex'),
    password: clientData.password || crypto.randomBytes(8).toString('hex'),
    auth: clientData.auth || crypto.randomBytes(8).toString('hex'),
    flow: clientData.flow || '',
    security: clientData.security || 'auto',
    totalGB: Number(clientData.totalGB) || 0,
    expiryTime: Number(clientData.expiryTime) || 0,
    reset: 0,
    limitIp: Number(clientData.limitIp) || 0,
    tgId: 0,
    group: clientData.group || '',
    comment: clientData.comment || '',
    enable: clientData.enable !== false
  };

  // Strategy 1: Modern 3x-ui POST /panel/api/clients/add
  try {
    const modernRes = await client.post('panel/api/clients/add', {
      client: clientObj,
      inboundIds: [Number(inboundId)]
    });
    if (modernRes.data?.success) {
      return { success: true, client: { ...clientObj, inboundId: Number(inboundId) } };
    }
    if (modernRes.data?.msg) {
      throw new Error(modernRes.data.msg);
    }
  } catch (err) {
    if (err.response && err.response.status !== 404 && err.response.status !== 405) {
      throw new Error(err.response.data?.msg || err.message);
    }
    if (!err.response) {
      throw err;
    }
  }

  // Strategy 2: Classic 3x-ui POST /panel/api/inbounds/addClient
  try {
    const payload = {
      id: Number(inboundId),
      settings: JSON.stringify({
        clients: [clientObj]
      })
    };

    const response = await client.post('panel/api/inbounds/addClient', payload);
    if (response.data?.success) {
      return { success: true, client: { ...clientObj, inboundId: Number(inboundId) } };
    }
    throw new Error(response.data?.msg || 'Failed to add client to inbound');
  } catch (err) {
    throw new Error(err.response?.data?.msg || err.message || 'Failed to add client to inbound');
  }
}


/**
 * Fetches instance system status (CPU, RAM, Disk, Uptime, Xray) from 3x-ui.
 */
async function getServerStatus(panelUrl, authConfigOrUsername, password) {
  const authConfig = resolveAuthConfig(authConfigOrUsername, password);
  const { client } = await getAuthenticatedClient(panelUrl, authConfig);

  let raw = null;

  // Strategy 1: Modern 3x-ui GET /panel/api/server/status
  try {
    const res = await client.get('panel/api/server/status');
    if (res.data?.success && res.data?.obj) {
      raw = res.data.obj;
    }
  } catch (err) {
    if (err.response && err.response.status !== 404) {
      throw new Error(err.response.data?.msg || err.message);
    }
  }

  // Strategy 2: Classic 3x-ui POST /server/status
  if (!raw) {
    try {
      const res = await client.post('server/status', {});
      if (res.data?.success && res.data?.obj) {
        raw = res.data.obj;
      }
    } catch (err) {
      if (err.response && err.response.status !== 404) {
        throw new Error(err.response.data?.msg || err.message);
      }
    }
  }

  // Strategy 3: Classic 3x-ui GET /server/status
  if (!raw) {
    try {
      const res = await client.get('server/status');
      if (res.data?.success && res.data?.obj) {
        raw = res.data.obj;
      }
    } catch (err) {
      throw new Error(err.response?.data?.msg || err.message || 'Failed to fetch server status');
    }
  }

  if (!raw) {
    throw new Error('Could not retrieve system status from panel');
  }

  const memTotal = raw.mem?.total || 0;
  const memCurrent = raw.mem?.current || 0;
  const memPercent = memTotal > 0 ? Math.min(100, Math.round((memCurrent / memTotal) * 100)) : 0;

  const diskTotal = raw.disk?.total || 0;
  const diskCurrent = raw.disk?.current || 0;
  const diskPercent = diskTotal > 0 ? Math.min(100, Math.round((diskCurrent / diskTotal) * 100)) : 0;

  let cpuVal = Number(raw.cpu) || 0;
  if (cpuVal > 0 && cpuVal <= 1) {
    cpuVal = parseFloat((cpuVal * 100).toFixed(1));
  } else {
    cpuVal = parseFloat(cpuVal.toFixed(1));
  }

  return {
    cpu: {
      percent: cpuVal,
      cores: raw.cpuCores || raw.logicalPro || 1,
      speedMhz: raw.cpuSpeedMhz || 0
    },
    mem: {
      current: memCurrent,
      total: memTotal,
      percent: memPercent
    },
    disk: {
      current: diskCurrent,
      total: diskTotal,
      percent: diskPercent
    },
    swap: {
      current: raw.swap?.current || 0,
      total: raw.swap?.total || 0
    },
    xray: {
      state: raw.xray?.state || 'running',
      version: raw.xray?.version || '',
      errorMsg: raw.xray?.errorMsg || ''
    },
    panelVersion: raw.panelVersion || '',
    uptime: raw.uptime || 0,
    loads: raw.loads || [],
    tcpCount: raw.tcpCount || 0,
    udpCount: raw.udpCount || 0,
    netIO: {
      up: raw.netIO?.up || 0,
      down: raw.netIO?.down || 0
    },
    netTraffic: {
      sent: raw.netTraffic?.sent || 0,
      recv: raw.netTraffic?.recv || 0
    },
    publicIP: raw.publicIP?.ipv4 || ''
  };
}

/**
 * Restarts the Xray core service live on the 3x-ui panel.
 */
async function restartXray(panelUrl, authConfigOrUsername, password) {
  const authConfig = resolveAuthConfig(authConfigOrUsername, password);
  const { client } = await getAuthenticatedClient(panelUrl, authConfig);

  const endpoints = [
    'panel/api/server/restartXrayService',
    'server/restartXrayService',
    'panel/server/restartXrayService',
    'xui/server/restartXrayService'
  ];

  let lastError = null;
  for (const endpoint of endpoints) {
    try {
      const res = await client.post(endpoint, {});
      if (res.data?.success) {
        return {
          success: true,
          message: res.data?.msg || 'Xray engine restarted successfully'
        };
      }
      if (res.data?.msg) {
        lastError = new Error(res.data.msg);
      }
    } catch (err) {
      if (err.response && err.response.status !== 404 && err.response.status !== 405) {
        throw new Error(err.response.data?.msg || err.message);
      }
      lastError = err;
    }
  }

  throw new Error(lastError?.message || 'Failed to restart Xray engine on this panel');
}

module.exports = {
  authenticate: authenticateWithCredentials,
  getAuthenticatedClient,
  testConnection,
  getInbounds,
  getInboundClients,
  updateClient,
  deleteClient,
  resetClientTraffic,
  addClient,
  getServerStatus,
  restartXray
};

