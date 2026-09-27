/**
 * linkGenerator.js
 * Generates standard V2Ray / Xray URIs (VLESS, VMess, Trojan, Shadowsocks)
 * and 3x-ui Subscription URLs for clients.
 */

function parseJsonSafe(val, fallback = {}) {
  if (!val) return fallback;
  if (typeof val === 'object') return val;
  try {
    return JSON.parse(val);
  } catch (_) {
    return fallback;
  }
}

function extractHost(panelUrl, inboundListen) {
  if (inboundListen && inboundListen !== '0.0.0.0' && inboundListen !== '::' && inboundListen !== '') {
    return inboundListen;
  }
  try {
    const url = new URL(panelUrl);
    return url.hostname;
  } catch (_) {
    return '127.0.0.1';
  }
}

function generateSubUrl(panelUrl, subId) {
  if (!subId) return '';
  try {
    const url = new URL(panelUrl);
    return `${url.protocol}//${url.host}/sub/${encodeURIComponent(subId)}`;
  } catch (_) {
    return `/sub/${subId}`;
  }
}

function generateVlessLink(client, inbound, host) {
  const stream = parseJsonSafe(inbound.streamSettings);
  const network = stream.network || 'tcp';
  const security = stream.security || 'none';
  const port = inbound.port;
  const uuid = client.id || client.uuid;
  const remark = encodeURIComponent(client.email || inbound.remark || 'vless');

  const params = new URLSearchParams();
  params.set('type', network);
  params.set('security', security);
  params.set('encryption', 'none');

  if (client.flow) {
    params.set('flow', client.flow);
  }

  if (security === 'reality') {
    const reality = stream.realitySettings || {};
    const realityInner = reality.settings || {};
    const pbk = realityInner.publicKey || reality.publicKey || '';
    const fp = realityInner.fingerprint || reality.fingerprint || 'chrome';
    const serverName = reality.serverNames?.[0] || realityInner.serverName || reality.serverName || host;
    const shortId = reality.shortIds?.[0] || '';
    const spiderX = realityInner.spiderX || reality.spiderX || '';

    if (pbk) params.set('pbk', pbk);
    if (fp) params.set('fp', fp);
    if (serverName) params.set('sni', serverName);
    if (shortId) params.set('sid', shortId);
    if (spiderX) params.set('spx', spiderX);
  } else if (security === 'tls') {
    const tls = stream.tlsSettings || {};
    const serverName = tls.serverName || host;
    const fp = tls.fingerprint || 'chrome';
    const alpn = Array.isArray(tls.alpn) ? tls.alpn.join(',') : (tls.alpn || '');

    if (serverName) params.set('sni', serverName);
    if (fp) params.set('fp', fp);
    if (alpn) params.set('alpn', alpn);
  }

  if (network === 'ws') {
    const ws = stream.wsSettings || {};
    if (ws.path) params.set('path', ws.path);
    const hostHeader = ws.headers?.Host || ws.headers?.host || '';
    if (hostHeader) params.set('host', hostHeader);
  } else if (network === 'grpc') {
    const grpc = stream.grpcSettings || {};
    if (grpc.serviceName) params.set('serviceName', grpc.serviceName);
    params.set('mode', 'multi');
  } else if (network === 'tcp') {
    const tcp = stream.tcpSettings || {};
    const header = tcp.header || {};
    if (header.type && header.type !== 'none') {
      params.set('headerType', header.type);
      const req = header.request || {};
      if (req.headers?.Host?.[0]) params.set('host', req.headers.Host[0]);
      if (req.path?.[0]) params.set('path', req.path[0]);
    }
  }

  return `vless://${uuid}@${host}:${port}?${params.toString()}#${remark}`;
}

function generateVmessLink(client, inbound, host) {
  const stream = parseJsonSafe(inbound.streamSettings);
  const network = stream.network || 'tcp';
  const security = stream.security || 'none';
  const port = inbound.port;
  const uuid = client.id || client.uuid;
  const remark = client.email || inbound.remark || 'vmess';

  let path = '';
  let hostHeader = '';
  let sni = '';
  let alpn = '';

  if (security === 'tls') {
    const tls = stream.tlsSettings || {};
    sni = tls.serverName || host;
    alpn = Array.isArray(tls.alpn) ? tls.alpn.join(',') : (tls.alpn || '');
  }

  if (network === 'ws') {
    const ws = stream.wsSettings || {};
    path = ws.path || '';
    hostHeader = ws.headers?.Host || ws.headers?.host || '';
  } else if (network === 'grpc') {
    const grpc = stream.grpcSettings || {};
    path = grpc.serviceName || '';
  }

  const vmessObj = {
    v: '2',
    ps: remark,
    add: host,
    port: Number(port),
    id: uuid,
    aid: 0,
    scy: 'auto',
    net: network,
    type: 'none',
    host: hostHeader,
    path: path,
    tls: security === 'tls' ? 'tls' : '',
    sni: sni,
    alpn: alpn
  };

  return `vmess://${Buffer.from(JSON.stringify(vmessObj)).toString('base64')}`;
}

function generateTrojanLink(client, inbound, host) {
  const stream = parseJsonSafe(inbound.streamSettings);
  const network = stream.network || 'tcp';
  const security = stream.security || 'tls';
  const port = inbound.port;
  const password = client.password || client.id;
  const remark = encodeURIComponent(client.email || inbound.remark || 'trojan');

  const params = new URLSearchParams();
  params.set('type', network);
  params.set('security', security);

  if (security === 'tls') {
    const tls = stream.tlsSettings || {};
    if (tls.serverName) params.set('sni', tls.serverName);
    if (tls.alpn) params.set('alpn', Array.isArray(tls.alpn) ? tls.alpn.join(',') : tls.alpn);
  }

  if (network === 'ws') {
    const ws = stream.wsSettings || {};
    if (ws.path) params.set('path', ws.path);
    const hostHeader = ws.headers?.Host || ws.headers?.host || '';
    if (hostHeader) params.set('host', hostHeader);
  } else if (network === 'grpc') {
    const grpc = stream.grpcSettings || {};
    if (grpc.serviceName) params.set('serviceName', grpc.serviceName);
  }

  return `trojan://${password}@${host}:${port}?${params.toString()}#${remark}`;
}

function generateShadowsocksLink(client, inbound, host) {
  const settings = parseJsonSafe(inbound.settings);
  const method = settings.method || 'aes-256-gcm';
  const password = client.password || settings.password || '';
  const port = inbound.port;
  const remark = encodeURIComponent(client.email || inbound.remark || 'shadowsocks');

  const creds = Buffer.from(`${method}:${password}`).toString('base64');
  return `ss://${creds}@${host}:${port}#${remark}`;
}

function generateClientLinks(client, inbound, panelUrl) {
  const host = extractHost(panelUrl, inbound.listen);
  const subUrl = generateSubUrl(panelUrl, client.subId);

  let v2rayLink = '';
  const proto = (inbound.protocol || '').toLowerCase();

  switch (proto) {
    case 'vless':
      v2rayLink = generateVlessLink(client, inbound, host);
      break;
    case 'vmess':
      v2rayLink = generateVmessLink(client, inbound, host);
      break;
    case 'trojan':
      v2rayLink = generateTrojanLink(client, inbound, host);
      break;
    case 'shadowsocks':
      v2rayLink = generateShadowsocksLink(client, inbound, host);
      break;
    default:
      v2rayLink = '';
  }

  return {
    subUrl,
    v2rayLink,
    host,
    port: inbound.port,
    protocol: proto
  };
}

module.exports = {
  generateClientLinks,
  generateSubUrl,
  extractHost,
  parseJsonSafe
};
