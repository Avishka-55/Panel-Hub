const config = require('../config/config');

/**
 * Cloudflare Turnstile token verification middleware.
 * Verifies that the client has solved the Turnstile challenge before proceeding.
 * 
 * If CLOUDFLARE_TURNSTILE_SECRET_KEY is not configured, the check passes silently
 * to allow smooth local development and testing.
 */
async function verifyTurnstile(req, res, next) {
  const secretKey = config.turnstileSecretKey;

  // If in test environment or Turnstile is not configured, bypass verification
  if (process.env.NODE_ENV === 'test' || !secretKey) {
    return next();
  }

  const token = req.body?.turnstileToken || req.body?.['cf-turnstile-response'];

  if (!token) {
    return res.status(400).json({
      success: false,
      error: 'Security challenge required. Please complete the verification check.'
    });
  }

  try {
    const clientIp =
      req.headers['cf-connecting-ip'] ||
      req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      req.socket?.remoteAddress;

    const formData = new URLSearchParams();
    formData.append('secret', secretKey);
    formData.append('response', token);
    if (clientIp) {
      formData.append('remoteip', clientIp);
    }

    const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: formData,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    const data = await verifyRes.json();

    if (!data.success) {
      console.warn('[Cloudflare Turnstile Failed]:', {
        errorCodes: data['error-codes'],
        clientIp,
        hostname: data.hostname
      });
      return res.status(403).json({
        success: false,
        error: 'Security check failed or expired. Please verify and try again.'
      });
    }

    // Challenge solved successfully!
    next();
  } catch (error) {
    console.error('[Cloudflare Turnstile Verification Error]:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to verify security challenge. Please try again.'
    });
  }
}

module.exports = { verifyTurnstile };
