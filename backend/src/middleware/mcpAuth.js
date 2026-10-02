const crypto = require('crypto');
const User = require('../models/User');

/**
 * Authentication middleware for Model Context Protocol (MCP) and external AI agents.
 * Validates 'Authorization: Bearer ph_live_...' or '?apiKey=ph_live_...' against stored SHA-256 hashes.
 */
async function authenticateMcp(req, res, next) {
  try {
    let rawKey = null;

    // 1. Check Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      rawKey = authHeader.slice(7).trim();
    } else if (req.query && req.query.apiKey) {
      rawKey = req.query.apiKey.trim();
    }

    if (!rawKey) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required. Please provide your PanelHub API key as a Bearer token or apiKey query parameter.'
      });
    }

    if (!rawKey.startsWith('ph_live_') || rawKey.length < 30) {
      return res.status(401).json({
        success: false,
        error: 'Invalid API key format. Expected a valid "ph_live_..." key.'
      });
    }

    // 2. Compute SHA-256 hash for constant-time indexed lookup
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

    // 3. Find matching active user
    const user = await User.findOne({ apiKeyHash: keyHash });
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or revoked API key. Please check your key in PanelHub Account Settings.'
      });
    }

    // 4. Update last used timestamp in background
    User.updateOne({ _id: user._id }, { apiKeyLastUsedAt: new Date() }).catch((err) => {
      console.warn('[MCP Auth] Failed to update apiKeyLastUsedAt:', err.message);
    });

    req.user = user;
    req.apiKey = rawKey;
    next();
  } catch (error) {
    console.error('[MCP Auth Error]:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to authenticate API request.'
    });
  }
}

module.exports = { authenticateMcp };
