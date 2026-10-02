const express = require('express');
const mongoose = require('mongoose');
const { z } = require('zod');
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { SSEServerTransport } = require('@modelcontextprotocol/sdk/server/sse.js');
const Server = require('../models/Server');
const { decrypt } = require('../utils/decrypt');
const panelService = require('../services/panelService');
const { authenticateMcp } = require('../middleware/mcpAuth');
const { generateClientLinks } = require('../utils/linkGenerator');

const router = express.Router();

// Active SSE sessions mapped by sessionId
const activeSessions = new Map();

/**
 * Decrypts in-memory authentication configuration for a panel.
 * Never logs or exposes credentials.
 */
function getDecryptedAuthConfig(server) {
  if (server.authType === 'api_key' && server.panelApiKeyEncrypted) {
    const apiKey = decrypt(
      server.panelApiKeyEncrypted,
      server.panelApiKeyIv,
      server.panelApiKeyAuthTag
    );
    return { apiKey };
  }

  const password = decrypt(
    server.panelPasswordEncrypted,
    server.panelPasswordIv,
    server.panelPasswordAuthTag
  );
  return {
    username: server.panelUsername,
    password
  };
}

/**
 * Helper to find a server owned by the user, matching either MongoDB _id or nickname (case-insensitive).
 */
async function findUserServer(userId, serverIdentifier) {
  let query = { ownerId: userId };

  if (mongoose.Types.ObjectId.isValid(serverIdentifier)) {
    query._id = serverIdentifier;
  } else {
    query.nickname = new RegExp('^' + serverIdentifier.trim() + '$', 'i');
  }

  return Server.findOne(query).select(
    '+panelPasswordEncrypted +panelPasswordIv +panelPasswordAuthTag +panelApiKeyEncrypted +panelApiKeyIv +panelApiKeyAuthTag'
  );
}

/**
 * Factory function creating a tenant-isolated McpServer instance for the authenticated user.
 */
function createPanelHubMcpServer(user) {
  const instructions = `You are connected to PanelHub, a centralized VPN & Proxy Fleet Orchestration Platform controlling distributed 3x-ui / Xray nodes.

### Your Available Capabilities & Roles:
1. Fleet Observability: Discover all connected VPN servers (list_vpn_servers) and check real-time CPU, RAM, disk usage, and Xray core health (get_server_status).
2. Protocol & Inbound Routing: Query configured inbounds, ports, protocols (VLESS, VMess, Trojan, Shadowsocks), client counts, and bandwidth totals (list_inbounds).
3. Client Provisioning: Provision new VPN client accounts with traffic quotas in GB and duration limits in days (add_client).
4. Client Inspection & Management: Inspect registered clients and live bandwidth consumption (list_clients), reset traffic counters (reset_client_traffic), and delete clients (delete_client).
5. Core Engine Maintenance: Soft-restart the remote Xray core engine to clear bottlenecks or reload configurations (restart_xray).
6. VPN Links & Subscriptions: Retrieve direct connection URIs (vless://, vmess://, trojan://, shadowsocks://) and 3x-ui subscription URLs for clients using get_client_link. Both connection links and subscription URLs are also automatically returned when calling add_client and list_clients.

### Operational Rules & Best Practices:
- Flexible Identifiers: In all tools accepting a "server" argument, you may supply either the server's human-friendly nickname (e.g., "Singapore", "Oracle 2", "Azure sg") or its MongoDB ObjectId.
- Discovery First: Before provisioning a client with add_client, always call list_vpn_servers to verify the node is online, and then list_inbounds to select the right inbound ID.
- Quota Units: Quotas in add_client are specified in Gigabytes (e.g. 20 for 20 GB, 0 = unlimited). Durations are specified in days (e.g. 30 for 30 days, 0 = no expiry).
- Safe Deletion: When asked to delete a client, verify the client UUID and inbound ID with the user before executing.
- Friendly Reporting: Format results in clear tables or bullet points with human-readable bandwidth (MB/GB) and timestamps.`;

  const mcpServer = new McpServer(
    {
      name: 'PanelHub Fleet Manager',
      version: '1.0.0'
    },
    {
      instructions
    }
  );

  // RESOURCE 1: Live fleet summary
  mcpServer.resource('fleet-summary', 'panelhub://fleet/summary', async (uri) => {
    try {
      const servers = await Server.find({ ownerId: user._id })
        .select('nickname panelUrl isOnline lastStats lastHealthCheck')
        .lean();

      const summary = {
        totalServers: servers.length,
        onlineServers: servers.filter((s) => s.isOnline).length,
        offlineServers: servers.filter((s) => !s.isOnline).length,
        servers: servers.map((s) => ({
          id: s._id.toString(),
          nickname: s.nickname,
          status: s.isOnline ? 'online' : 'offline',
          panelUrl: s.panelUrl,
          cpu: s.lastStats?.cpu ? `${s.lastStats.cpu.toFixed(1)}%` : 'N/A',
          memory: s.lastStats?.mem ? `${s.lastStats.mem.toFixed(1)}%` : 'N/A'
        }))
      };

      return {
        contents: [
          {
            uri: uri.href,
            text: JSON.stringify(summary, null, 2),
            mimeType: 'application/json'
          }
        ]
      };
    } catch (err) {
      return {
        contents: [
          {
            uri: uri.href,
            text: JSON.stringify({ error: err.message }),
            mimeType: 'application/json'
          }
        ]
      };
    }
  });

  // RESOURCE 2: Fleet Guide and Architecture Overview
  mcpServer.resource('fleet-capabilities-guide', 'panelhub://fleet/guide', async (uri) => {
    return {
      contents: [
        {
          uri: uri.href,
          text: instructions,
          mimeType: 'text/markdown'
        }
      ]
    };
  });

  // PROMPT 1: Fleet Health Audit
  mcpServer.prompt(
    'audit_fleet_health',
    'Perform a comprehensive health and resource utilization audit across all VPN server nodes',
    {},
    () => {
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: 'Please run a full health check across all my VPN servers using list_vpn_servers. Summarize online/offline status, flag any servers with CPU/RAM above 80%, and recommend optimizations if any issues are found.'
            }
          }
        ]
      };
    }
  );

  // PROMPT 2: Guided Client Provisioning
  mcpServer.prompt(
    'provision_vpn_client',
    'Interactive workflow to select the best server node, choose an inbound protocol, and provision a new VPN user',
    {
      clientName: z.string().describe('Name or email of the client to provision'),
      quotaGB: z.string().optional().describe('Data quota in GB (e.g. 50), default unlimited'),
      durationDays: z.string().optional().describe('Validity duration in days (e.g. 30), default unlimited')
    },
    ({ clientName, quotaGB = '0', durationDays = '0' }) => {
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `I want to provision a new VPN client named "${clientName}" with ${quotaGB === '0' ? 'unlimited' : quotaGB + ' GB'} data quota for ${durationDays === '0' ? 'unlimited' : durationDays + ' days'}. First, inspect my servers with list_vpn_servers and list_inbounds on the best server, then provision the client using add_client.`
            }
          }
        ]
      };
    }
  );

  // PROMPT 3: Troubleshoot Server
  mcpServer.prompt(
    'troubleshoot_server',
    'Diagnose connection bottlenecks, check telemetry, and soft-restart Xray core on a node',
    {
      server: z.string().describe('Server nickname or ID to troubleshoot')
    },
    ({ server: targetServer }) => {
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Please troubleshoot VPN server "${targetServer}". Fetch its real-time telemetry and Xray status using get_server_status, inspect its inbounds with list_inbounds, and if it appears degraded or clients cannot connect, restart its Xray core engine with restart_xray.`
            }
          }
        ]
      };
    }
  );

  // TOOL 1: list_vpn_servers
  mcpServer.tool(
    'list_vpn_servers',
    'Discover all connected 3x-ui VPN servers in your account. Returns database IDs, server nicknames, online/offline status, real-time CPU%, RAM%, disk usage%, uptime, and panel URLs. ALWAYS call this tool first to discover available server IDs or nicknames.',
    {},
    async () => {
      try {
        const servers = await Server.find({ ownerId: user._id })
          .select('nickname panelUrl authType isOnline lastHealthCheck lastStats createdAt')
          .lean();

        const formatted = servers.map((s) => ({
          id: s._id.toString(),
          nickname: s.nickname,
          panelUrl: s.panelUrl,
          isOnline: s.isOnline,
          lastHealthCheck: s.lastHealthCheck,
          cpuUsage: s.lastStats?.cpu ? `${s.lastStats.cpu.toFixed(1)}%` : 'N/A',
          memoryUsage: s.lastStats?.mem ? `${s.lastStats.mem.toFixed(1)}%` : 'N/A',
          diskUsage: s.lastStats?.disk ? `${s.lastStats.disk.toFixed(1)}%` : 'N/A',
          uptime: s.lastStats?.uptime || 'N/A'
        }));

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ count: formatted.length, servers: formatted }, null, 2)
            }
          ]
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Failed to list servers: ${err.message}` }]
        };
      }
    }
  );

  // TOOL 2: get_server_status
  mcpServer.tool(
    'get_server_status',
    'Fetch live real-time hardware telemetry (CPU load, RAM consumption, storage disk usage, server uptime) and Xray core service status for a specified server.',
    {
      server: z.string().describe('Server nickname (e.g. "Singapore", "Oracle 2") or MongoDB ObjectId')
    },
    async ({ server: serverIdentifier }) => {
      try {
        const server = await findUserServer(user._id, serverIdentifier);
        if (!server) {
          return {
            isError: true,
            content: [{ type: 'text', text: `Server "${serverIdentifier}" not found in your account.` }]
          };
        }

        const authConfig = getDecryptedAuthConfig(server);
        const status = await panelService.getServerStatus(server.panelUrl, authConfig);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  server: server.nickname,
                  panelUrl: server.panelUrl,
                  status: status.obj || status
                },
                null,
                2
              )
            }
          ]
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Failed to get status for "${serverIdentifier}": ${err.message}` }]
        };
      }
    }
  );

  // TOOL 3: list_inbounds
  mcpServer.tool(
    'list_inbounds',
    'List all VPN proxy inbounds configured on a specific server. Returns inbound IDs, ports, protocols (VLESS, VMess, Trojan, Shadowsocks), remarks/tags, enabled status, active client counts, and cumulative bandwidth.',
    {
      server: z.string().describe('Server nickname (e.g. "Singapore", "Oracle 2") or MongoDB ObjectId')
    },
    async ({ server: serverIdentifier }) => {
      try {
        const server = await findUserServer(user._id, serverIdentifier);
        if (!server) {
          return {
            isError: true,
            content: [{ type: 'text', text: `Server "${serverIdentifier}" not found.` }]
          };
        }

        const authConfig = getDecryptedAuthConfig(server);
        const inboundsData = await panelService.getInbounds(server.panelUrl, authConfig);
        const inbounds = inboundsData.obj || inboundsData;

        const summary = (Array.isArray(inbounds) ? inbounds : []).map((ib) => {
          let clientCount = 0;
          try {
            const settings = typeof ib.settings === 'string' ? JSON.parse(ib.settings) : ib.settings;
            clientCount = settings?.clients?.length || 0;
          } catch (_) {}

          return {
            inboundId: ib.id,
            port: ib.port,
            protocol: ib.protocol,
            remark: ib.remark,
            tag: ib.tag,
            enable: ib.enable,
            clientCount,
            upTrafficBytes: ib.up,
            downTrafficBytes: ib.down,
            totalTrafficBytes: ib.total
          };
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ server: server.nickname, inbounds: summary }, null, 2)
            }
          ]
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Failed to list inbounds: ${err.message}` }]
        };
      }
    }
  );

  // TOOL 4: list_clients
  mcpServer.tool(
    'list_clients',
    'List VPN client users registered on a specific server (optionally filtered by inboundId). Returns client UUIDs, email tags, enable/disable status, allocated data limits, real-time uploaded/downloaded bytes, and expiration dates.',
    {
      server: z.string().describe('Server nickname or MongoDB ObjectId'),
      inboundId: z.number().optional().describe('Optional Inbound ID to inspect clients for only that specific inbound port')
    },
    async ({ server: serverIdentifier, inboundId }) => {
      try {
        const server = await findUserServer(user._id, serverIdentifier);
        if (!server) {
          return {
            isError: true,
            content: [{ type: 'text', text: `Server "${serverIdentifier}" not found.` }]
          };
        }

        const authConfig = getDecryptedAuthConfig(server);
        const inboundsData = await panelService.getInbounds(server.panelUrl, authConfig);
        const inbounds = Array.isArray(inboundsData.obj) ? inboundsData.obj : Array.isArray(inboundsData) ? inboundsData : [];

        let allClients = [];

        for (const ib of inbounds) {
          if (inboundId !== undefined && ib.id !== inboundId) continue;

          let clients = [];
          try {
            const settings = typeof ib.settings === 'string' ? JSON.parse(ib.settings) : ib.settings;
            clients = settings?.clients || [];
          } catch (_) {}

          const clientStatsMap = new Map();
          if (Array.isArray(ib.clientStats)) {
            ib.clientStats.forEach((cs) => {
              clientStatsMap.set(cs.email, cs);
            });
          }

          for (const c of clients) {
            const stats = clientStatsMap.get(c.email) || {};
            const links = generateClientLinks(c, ib, server.panelUrl);
            allClients.push({
              inboundId: ib.id,
              inboundRemark: ib.remark,
              protocol: ib.protocol,
              id: c.id,
              email: c.email,
              subId: c.subId || '',
              vlessLink: links.v2rayLink,
              connectionLink: links.v2rayLink,
              subscriptionUrl: links.subUrl,
              enable: c.enable !== false,
              totalBytes: c.totalGB || 0,
              usedUpBytes: stats.up || 0,
              usedDownBytes: stats.down || 0,
              expiryDate: c.expiryTime > 0 ? new Date(c.expiryTime).toISOString() : 'Never'
            });
          }
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  server: server.nickname,
                  totalClients: allClients.length,
                  clients: allClients
                },
                null,
                2
              )
            }
          ]
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Failed to list clients: ${err.message}` }]
        };
      }
    }
  );

  // TOOL 5: add_client
  mcpServer.tool(
    'add_client',
    'Provision a new VPN client on a specific server and inbound. Generates user credentials with optional data quota in GB and time limit in days. Returns the newly created client UUID, configuration details, direct connection URI (vless://), and subscription URL.',
    {
      server: z.string().describe('Server nickname or MongoDB ObjectId'),
      inboundId: z.number().describe('Target Inbound ID (found from list_inbounds)'),
      email: z.string().describe('Unique client email, username, or label (e.g. "john@mobile", "alice_laptop")'),
      totalGB: z.number().optional().describe('Bandwidth quota in Gigabytes (e.g. 50 for 50 GB). Default 0 = unlimited'),
      expiryDays: z.number().optional().describe('Validity duration in days from today (e.g. 30 for 30 days). Default 0 = no expiration')
    },
    async ({ server: serverIdentifier, inboundId, email, totalGB = 0, expiryDays = 0 }) => {
      try {
        const server = await findUserServer(user._id, serverIdentifier);
        if (!server) {
          return {
            isError: true,
            content: [{ type: 'text', text: `Server "${serverIdentifier}" not found.` }]
          };
        }

        const authConfig = getDecryptedAuthConfig(server);
        const totalBytes = totalGB > 0 ? totalGB * 1073741824 : 0;
        const expiryTime = expiryDays > 0 ? Date.now() + expiryDays * 86400000 : 0;

        const result = await panelService.addClient(server.panelUrl, authConfig, inboundId, {
          email,
          totalGB: totalBytes,
          expiryTime
        });

        // Generate direct VLESS / subscription links for immediate client use
        let connectionLink = '';
        let subscriptionUrl = '';
        try {
          const inboundsData = await panelService.getInbounds(server.panelUrl, authConfig);
          const inbounds = Array.isArray(inboundsData.obj) ? inboundsData.obj : Array.isArray(inboundsData) ? inboundsData : [];
          const targetIb = inbounds.find((ib) => ib.id === Number(inboundId));
          if (targetIb) {
            const clientPayload = result.client || { email, id: result.id, subId: result.subId };
            const links = generateClientLinks(clientPayload, targetIb, server.panelUrl);
            connectionLink = links.v2rayLink;
            subscriptionUrl = links.subUrl;
          }
        } catch (_) {}

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  message: `Client "${email}" created successfully on ${server.nickname}!`,
                  server: server.nickname,
                  inboundId,
                  email,
                  totalGB: totalGB > 0 ? `${totalGB} GB` : 'Unlimited',
                  expiresIn: expiryDays > 0 ? `${expiryDays} days` : 'Never',
                  vlessLink: connectionLink,
                  connectionLink: connectionLink,
                  subscriptionUrl: subscriptionUrl,
                  clientData: result
                },
                null,
                2
              )
            }
          ]
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Failed to add client "${email}": ${err.message}` }]
        };
      }
    }
  );

  // TOOL 6: delete_client
  mcpServer.tool(
    'delete_client',
    'Permanently delete a VPN client user from a server inbound by their client UUID/ID or email. Use list_clients first to confirm the client ID.',
    {
      server: z.string().describe('Server nickname or MongoDB ObjectId'),
      inboundId: z.number().optional().describe('Target Inbound ID containing the client (optional)'),
      clientId: z.string().describe('Client ID, UUID, or email (obtained from list_clients)')
    },
    async ({ server: serverIdentifier, inboundId, clientId }) => {
      try {
        const server = await findUserServer(user._id, serverIdentifier);
        if (!server) {
          return {
            isError: true,
            content: [{ type: 'text', text: `Server "${serverIdentifier}" not found.` }]
          };
        }

        const authConfig = getDecryptedAuthConfig(server);
        await panelService.deleteClient(server.panelUrl, authConfig, clientId, inboundId);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                message: `Client ${clientId} was deleted successfully from ${server.nickname}.`,
                server: server.nickname,
                clientId
              })
            }
          ]
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Failed to delete client: ${err.message}` }]
        };
      }
    }
  );

  // TOOL 7: reset_client_traffic
  mcpServer.tool(
    'reset_client_traffic',
    'Reset cumulative uploaded and downloaded bandwidth counters back to 0 for a specific client email on an inbound.',
    {
      server: z.string().describe('Server nickname or MongoDB ObjectId'),
      inboundId: z.number().optional().describe('Target Inbound ID containing the client (optional)'),
      clientEmail: z.string().describe('Client email or tag identifier (e.g. "john@mobile")')
    },
    async ({ server: serverIdentifier, inboundId, clientEmail }) => {
      try {
        const server = await findUserServer(user._id, serverIdentifier);
        if (!server) {
          return {
            isError: true,
            content: [{ type: 'text', text: `Server "${serverIdentifier}" not found.` }]
          };
        }

        const authConfig = getDecryptedAuthConfig(server);
        await panelService.resetClientTraffic(server.panelUrl, authConfig, clientEmail, inboundId);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                message: `Traffic counter for client "${clientEmail}" on ${server.nickname} has been reset to 0.`
              })
            }
          ]
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Failed to reset client traffic: ${err.message}` }]
        };
      }
    }
  );

  // TOOL 8: restart_xray
  mcpServer.tool(
    'restart_xray',
    'Soft-restart the live Xray proxy core engine on a remote 3x-ui server to clear connection bottlenecks, reload inbound listeners, or resolve routing errors.',
    {
      server: z.string().describe('Server nickname or MongoDB ObjectId')
    },
    async ({ server: serverIdentifier }) => {
      try {
        const server = await findUserServer(user._id, serverIdentifier);
        if (!server) {
          return {
            isError: true,
            content: [{ type: 'text', text: `Server "${serverIdentifier}" not found.` }]
          };
        }

        const authConfig = getDecryptedAuthConfig(server);
        const result = await panelService.restartXray(server.panelUrl, authConfig);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                server: server.nickname,
                message: result.message || 'Xray engine restarted successfully.'
              })
            }
          ]
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Failed to restart Xray: ${err.message}` }]
        };
      }
    }
  );

  // TOOL 9: get_client_link
  mcpServer.tool(
    'get_client_link',
    'Retrieve the direct VPN connection URI (vless://, vmess://, trojan://, or shadowsocks://) and 3x-ui subscription URL for a specific client on a server.',
    {
      server: z.string().describe('Server nickname (e.g. "Singapore", "Oracle 2") or MongoDB ObjectId'),
      client: z.string().describe('Client email, username, or UUID/ID (e.g. "alice@mobile" or "c1a11111-...")'),
      inboundId: z.number().optional().describe('Optional specific Inbound ID')
    },
    async ({ server: serverIdentifier, client: clientIdentifier, inboundId }) => {
      try {
        const server = await findUserServer(user._id, serverIdentifier);
        if (!server) {
          return {
            isError: true,
            content: [{ type: 'text', text: `Server "${serverIdentifier}" not found.` }]
          };
        }

        const authConfig = getDecryptedAuthConfig(server);
        const inboundsData = await panelService.getInbounds(server.panelUrl, authConfig);
        const inbounds = Array.isArray(inboundsData.obj) ? inboundsData.obj : Array.isArray(inboundsData) ? inboundsData : [];

        const needle = clientIdentifier.trim().toLowerCase();
        let matchedClient = null;
        let matchedInbound = null;

        for (const ib of inbounds) {
          if (inboundId !== undefined && ib.id !== inboundId) continue;

          let clients = [];
          try {
            const settings = typeof ib.settings === 'string' ? JSON.parse(ib.settings) : ib.settings;
            clients = settings?.clients || [];
          } catch (_) {}

          for (const c of clients) {
            const email = (c.email || '').trim().toLowerCase();
            const id = String(c.id || '').trim().toLowerCase();
            if (email === needle || id === needle || email.includes(needle)) {
              matchedClient = c;
              matchedInbound = ib;
              break;
            }
          }
          if (matchedClient) break;
        }

        if (!matchedClient || !matchedInbound) {
          return {
            isError: true,
            content: [{ type: 'text', text: `Client "${clientIdentifier}" not found on server "${server.nickname}".` }]
          };
        }

        const links = generateClientLinks(matchedClient, matchedInbound, server.panelUrl);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  server: server.nickname,
                  clientEmail: matchedClient.email,
                  clientId: matchedClient.id,
                  subId: matchedClient.subId || '',
                  protocol: matchedInbound.protocol,
                  port: matchedInbound.port,
                  inboundRemark: matchedInbound.remark,
                  vlessLink: links.v2rayLink,
                  connectionLink: links.v2rayLink,
                  subscriptionUrl: links.subUrl,
                  instructions: 'Import the connectionLink (e.g. vless://...) directly into v2rayN, v2rayNG, Sing-box, Nekoray, or Shadowrocket, or subscribe using the subscriptionUrl.'
                },
                null,
                2
              )
            }
          ]
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Failed to get client link: ${err.message}` }]
        };
      }
    }
  );

  return mcpServer;
}

async function handleSseConnection(req, res) {
  try {
    // Disable Nginx proxy buffering for Server-Sent Events
    res.setHeader('X-Accel-Buffering', 'no');

    const basePath = req.baseUrl || '/mcp';
    const transport = new SSEServerTransport(`${basePath}/messages`, res);
    const mcpServer = createPanelHubMcpServer(req.user);

    activeSessions.set(transport.sessionId, {
      transport,
      mcpServer,
      user: req.user
    });

    res.on('close', () => {
      activeSessions.delete(transport.sessionId);
    });

    await mcpServer.connect(transport);
  } catch (error) {
    console.error('[MCP SSE Error]:', error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

/**
 * GET /mcp or /api/mcp
 * Dual-purpose endpoint:
 * 1. If accessed with Accept: text/event-stream or with apiKey/Bearer token, establishes SSE transport.
 * 2. Otherwise returns service discovery JSON manifest.
 */
router.get('/', (req, res, next) => {
  const isSse = req.headers.accept && req.headers.accept.includes('text/event-stream');
  if (isSse || req.query.apiKey || (req.headers.authorization && req.headers.authorization.startsWith('Bearer '))) {
    return authenticateMcp(req, res, () => handleSseConnection(req, res));
  }

  const basePath = req.baseUrl || '/mcp';
  res.status(200).json({
    service: 'PanelHub Model Context Protocol (MCP) Server',
    version: '1.0.0',
    protocol: 'SSE (Server-Sent Events)',
    endpoints: {
      sse: `${basePath}/sse`,
      messages: `${basePath}/messages`
    },
    status: 'operational'
  });
});

/**
 * GET /mcp/sse or /api/mcp/sse
 * Explicit SSE endpoint for clients specifying the /sse subpath.
 */
router.get('/sse', authenticateMcp, handleSseConnection);

/**
 * POST /mcp/messages
 * Handles incoming JSON-RPC client messages (tool calls, lists) routed through the active SSE transport session.
 */
router.post('/messages', async (req, res) => {
  try {
    const sessionId = req.query.sessionId;
    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required "sessionId" query parameter.'
      });
    }

    const session = activeSessions.get(sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Active MCP session not found or expired. Please re-establish SSE connection.'
      });
    }

    await session.transport.handlePostMessage(req, res, req.body);
  } catch (error) {
    console.error('[MCP Messages Error]:', error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
});

module.exports = router;
