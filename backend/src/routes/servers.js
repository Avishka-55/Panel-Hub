const express = require('express');
const mongoose = require('mongoose');
const Server = require('../models/Server');
const { encrypt } = require('../utils/encrypt');
const { decrypt } = require('../utils/decrypt');
const panelService = require('../services/panelService');
const { authenticateToken } = require('../middleware/auth');
const { proxyLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// Protect all server routes with JWT authentication
router.use(authenticateToken);

/**
 * Helper to fetch a server owned by the authenticated user with credentials included for proxy actions.
 */
async function getOwnedServerWithCredentials(serverId, userId) {
  if (!mongoose.Types.ObjectId.isValid(serverId)) {
    return null;
  }
  return Server.findOne({
    _id: serverId,
    ownerId: userId
  }).select(
    '+panelPasswordEncrypted +panelPasswordIv +panelPasswordAuthTag +panelApiKeyEncrypted +panelApiKeyIv +panelApiKeyAuthTag'
  );
}

/**
 * Decrypts in-memory authentication configuration for the panel.
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
 * GET /api/servers
 * List all connected servers for the authenticated user.
 */
router.get('/', async (req, res) => {
  try {
    const servers = await Server.find({ ownerId: req.user._id }).sort({ createdAt: -1 });
    return res.status(200).json({
      success: true,
      servers
    });
  } catch (error) {
    console.error('[Get Servers Error]:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve servers'
    });
  }
});

/**
 * POST /api/servers
 * Connect and add a new 3x-ui server.
 * Supports both API Key (Bearer token) and Username/Password modes.
 * Secrets are encrypted via AES-256-GCM before saving to MongoDB and never returned.
 */
router.post('/', async (req, res) => {
  try {
    const { nickname, panelUrl, authType = 'credentials' } = req.body;

    if (!nickname || !panelUrl) {
      return res.status(400).json({
        success: false,
        error: 'Nickname and panelUrl are required'
      });
    }

    const isApiKey = authType === 'api_key';
    let authConfig;
    let encryptedCreds;

    if (isApiKey) {
      const { apiKey } = req.body;
      if (!apiKey || !apiKey.trim()) {
        return res.status(400).json({
          success: false,
          error: 'API Key is required when using API Key authentication'
        });
      }
      authConfig = { apiKey: apiKey.trim() };
      encryptedCreds = encrypt(apiKey.trim());
    } else {
      const { panelUsername, panelPassword } = req.body;
      if (!panelUsername || !panelPassword) {
        return res.status(400).json({
          success: false,
          error: 'Panel username and password are required for credentials authentication'
        });
      }
      authConfig = { username: panelUsername.trim(), password: panelPassword };
      encryptedCreds = encrypt(panelPassword);
    }

    // Initial connection test
    let initialStatus = 'untested';
    let inboundCount = 0;
    let initialError = null;

    try {
      const connTest = await panelService.testConnection(panelUrl, authConfig);
      if (connTest.success) {
        initialStatus = 'online';
        inboundCount = connTest.inboundCount;
      }
    } catch (testErr) {
      console.warn(`[Server Add Notice] Connection test failed for "${nickname}": ${testErr.message}`);
      initialStatus = 'error';
      initialError = testErr.message;
    }

    const serverData = {
      ownerId: req.user._id,
      nickname: nickname.trim(),
      panelUrl: panelUrl.trim(),
      authType: isApiKey ? 'api_key' : 'credentials',
      status: initialStatus,
      lastError: initialError,
      inboundCount,
      lastConnectedAt: initialStatus === 'online' ? new Date() : null
    };

    if (isApiKey) {
      serverData.panelApiKeyEncrypted = encryptedCreds.ciphertext;
      serverData.panelApiKeyIv = encryptedCreds.iv;
      serverData.panelApiKeyAuthTag = encryptedCreds.authTag;
    } else {
      serverData.panelUsername = req.body.panelUsername.trim();
      serverData.panelPasswordEncrypted = encryptedCreds.ciphertext;
      serverData.panelPasswordIv = encryptedCreds.iv;
      serverData.panelPasswordAuthTag = encryptedCreds.authTag;
    }

    const server = new Server(serverData);
    await server.save();

    return res.status(201).json({
      success: true,
      message: 'Server added successfully',
      server
    });
  } catch (error) {
    console.error('[Add Server Error]:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to register server'
    });
  }
});

/**
 * GET /api/servers/:id
 * Retrieve single server details (never credentials or API keys).
 */
router.get('/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, error: 'Invalid server ID format' });
    }

    const server = await Server.findOne({ _id: req.params.id, ownerId: req.user._id });
    if (!server) {
      return res.status(404).json({ success: false, error: 'Server not found or access denied' });
    }

    return res.status(200).json({
      success: true,
      server
    });
  } catch (error) {
    console.error('[Get Server Details Error]:', error.message);
    return res.status(500).json({ success: false, error: 'Failed to fetch server details' });
  }
});

/**
 * DELETE /api/servers/:id
 * Remove a server from the platform.
 */
router.delete('/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, error: 'Invalid server ID format' });
    }

    const server = await Server.findOneAndDelete({
      _id: req.params.id,
      ownerId: req.user._id
    });

    if (!server) {
      return res.status(404).json({
        success: false,
        error: 'Server not found or access denied'
      });
    }

    return res.status(200).json({
      success: true,
      message: `Server "${server.nickname}" removed successfully`
    });
  } catch (error) {
    console.error('[Delete Server Error]:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete server'
    });
  }
});

/**
 * POST /api/servers/:id/test
 * Test live connection to a connected server.
 */
router.post('/:id/test', proxyLimiter, async (req, res) => {
  try {
    const server = await getOwnedServerWithCredentials(req.params.id, req.user._id);
    if (!server) {
      return res.status(404).json({ success: false, error: 'Server not found or access denied' });
    }

    const authConfig = getDecryptedAuthConfig(server);

    try {
      const result = await panelService.testConnection(server.panelUrl, authConfig);

      server.status = 'online';
      server.lastConnectedAt = new Date();
      server.inboundCount = result.inboundCount;
      server.lastError = null;
      await server.save();

      return res.status(200).json({
        success: true,
        message: 'Connected to 3x-ui panel successfully',
        status: 'online',
        inboundCount: result.inboundCount
      });
    } catch (panelErr) {
      server.status = 'offline';
      server.lastError = panelErr.message;
      await server.save();

      return res.status(502).json({
        success: false,
        status: 'offline',
        error: panelErr.message
      });
    }
  } catch (error) {
    console.error('[Test Connection Error]:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to perform panel connection test'
    });
  }
});

/**
 * GET /api/servers/:id/inbounds
 * Live inbounds proxy.
 */
router.get('/:id/inbounds', proxyLimiter, async (req, res) => {
  try {
    const server = await getOwnedServerWithCredentials(req.params.id, req.user._id);
    if (!server) {
      return res.status(404).json({ success: false, error: 'Server not found or access denied' });
    }

    const authConfig = getDecryptedAuthConfig(server);

    try {
      const inbounds = await panelService.getInbounds(server.panelUrl, authConfig);

      server.status = 'online';
      server.lastConnectedAt = new Date();
      server.inboundCount = inbounds.length;
      server.lastError = null;
      await server.save();

      return res.status(200).json({
        success: true,
        inbounds
      });
    } catch (panelErr) {
      server.status = 'error';
      server.lastError = panelErr.message;
      await server.save();

      return res.status(502).json({
        success: false,
        error: `3x-ui panel error: ${panelErr.message}`
      });
    }
  } catch (error) {
    console.error('[Get Inbounds Error]:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve inbounds'
    });
  }
});

/**
 * GET /api/servers/:id/inbounds/:inboundId/clients
 * Live inbound clients proxy.
 */
router.get('/:id/inbounds/:inboundId/clients', proxyLimiter, async (req, res) => {
  try {
    const { id, inboundId } = req.params;
    const server = await getOwnedServerWithCredentials(id, req.user._id);
    if (!server) {
      return res.status(404).json({ success: false, error: 'Server not found or access denied' });
    }

    const authConfig = getDecryptedAuthConfig(server);

    try {
      const clients = await panelService.getInboundClients(
        server.panelUrl,
        authConfig,
        inboundId
      );

      return res.status(200).json({
        success: true,
        inboundId: Number(inboundId),
        clients
      });
    } catch (panelErr) {
      return res.status(502).json({
        success: false,
        error: `3x-ui panel error: ${panelErr.message}`
      });
    }
  } catch (error) {
    console.error('[Get Clients Error]:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve clients'
    });
  }
});

/**
 * POST /api/servers/:id/inbounds/:inboundId/clients
 * Add client live on panel.
 */
router.post('/:id/inbounds/:inboundId/clients', proxyLimiter, async (req, res) => {
  try {
    const { id, inboundId } = req.params;
    const server = await getOwnedServerWithCredentials(id, req.user._id);
    if (!server) {
      return res.status(404).json({ success: false, error: 'Server not found or access denied' });
    }

    const { email, totalGB, expiryTime, enable, limitIp } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, error: 'Client email is required' });
    }

    const authConfig = getDecryptedAuthConfig(server);

    const crypto = require('crypto');
    const newClient = {
      id: crypto.randomUUID(),
      email: email.trim(),
      enable: enable !== false,
      totalGB: totalGB ? Number(totalGB) : 0,
      expiryTime: expiryTime ? Number(expiryTime) : 0,
      limitIp: limitIp ? Number(limitIp) : 0,
      flow: ''
    };

    const result = await panelService.addClient(
      server.panelUrl,
      authConfig,
      inboundId,
      newClient
    );

    return res.status(201).json({
      success: true,
      message: 'Client added successfully',
      client: result.client
    });
  } catch (error) {
    console.error('[Add Client Error]:', error.message);
    return res.status(502).json({
      success: false,
      error: `Failed to add client: ${error.message}`
    });
  }
});

/**
 * PATCH /api/servers/:id/clients/:clientId
 * Live client update.
 */
router.patch('/:id/clients/:clientId', proxyLimiter, async (req, res) => {
  try {
    const { id, clientId } = req.params;
    const server = await getOwnedServerWithCredentials(id, req.user._id);
    if (!server) {
      return res.status(404).json({ success: false, error: 'Server not found or access denied' });
    }

    const { expiryTime, totalGB, enable, email, inboundId } = req.body;
    const authConfig = getDecryptedAuthConfig(server);

    try {
      const result = await panelService.updateClient(
        server.panelUrl,
        authConfig,
        clientId,
        {
          inboundId: inboundId || req.query.inboundId,
          expiryTime,
          totalGB,
          enable,
          email
        }
      );

      return res.status(200).json({
        success: true,
        message: 'Client updated successfully',
        client: result.client
      });
    } catch (panelErr) {
      return res.status(502).json({
        success: false,
        error: `Failed to update client on 3x-ui panel: ${panelErr.message}`
      });
    }
  } catch (error) {
    console.error('[Update Client Error]:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to update client'
    });
  }
});

/**
 * DELETE /api/servers/:id/clients/:clientId
 * Live client deletion.
 */
router.delete('/:id/clients/:clientId', proxyLimiter, async (req, res) => {
  try {
    const { id, clientId } = req.params;
    const inboundId = req.query.inboundId || req.body?.inboundId;

    const server = await getOwnedServerWithCredentials(id, req.user._id);
    if (!server) {
      return res.status(404).json({ success: false, error: 'Server not found or access denied' });
    }

    const authConfig = getDecryptedAuthConfig(server);

    try {
      await panelService.deleteClient(
        server.panelUrl,
        authConfig,
        clientId,
        inboundId
      );

      return res.status(200).json({
        success: true,
        message: `Client "${clientId}" deleted successfully from 3x-ui panel`
      });
    } catch (panelErr) {
      return res.status(502).json({
        success: false,
        error: `Failed to delete client from 3x-ui panel: ${panelErr.message}`
      });
    }
  } catch (error) {
    console.error('[Delete Client Error]:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete client'
    });
  }
});

/**
 * POST /api/servers/:id/clients/:clientId/reset-traffic
 * Live client traffic reset.
 */
router.post('/:id/clients/:clientId/reset-traffic', proxyLimiter, async (req, res) => {
  try {
    const { id, clientId } = req.params;
    const inboundId = req.query.inboundId || req.body?.inboundId;

    const server = await getOwnedServerWithCredentials(id, req.user._id);
    if (!server) {
      return res.status(404).json({ success: false, error: 'Server not found or access denied' });
    }

    const authConfig = getDecryptedAuthConfig(server);

    try {
      const result = await panelService.resetClientTraffic(
        server.panelUrl,
        authConfig,
        clientId,
        inboundId
      );

      return res.status(200).json({
        success: true,
        message: `Traffic reset successfully for client (${result.email || clientId})`
      });
    } catch (panelErr) {
      return res.status(502).json({
        success: false,
        error: `Failed to reset client traffic on 3x-ui panel: ${panelErr.message}`
      });
    }
  } catch (error) {
    console.error('[Reset Traffic Error]:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to reset client traffic'
    });
  }
});

module.exports = router;
