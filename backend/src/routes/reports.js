/**
 * routes/reports.js
 * Operations and Daily Digest reporting API.
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { proxyLimiter } = require('../middleware/rateLimiter');
const User = require('../models/User');
const {
  generateReportDataForUser,
  sendDailyReportForUser
} = require('../services/dailyReportService');

// All report routes require authentication
router.use(authenticateToken);

/**
 * GET /api/reports/daily/preview
 * Returns live preview metrics of the daily digest for the current user.
 */
router.get('/daily/preview', async (req, res) => {
  try {
    const reportData = await generateReportDataForUser(req.user);
    const user = await User.findById(req.user._id).select('dailyReport');

    return res.status(200).json({
      success: true,
      preferences: user?.dailyReport || { enabled: true, hourUtc: 9 },
      reportData
    });
  } catch (err) {
    console.error('[Report Preview Error]:', err.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to generate daily report preview'
    });
  }
});

/**
 * POST /api/reports/daily/send-now
 * Manually dispatches today's daily operations digest to the authenticated user's email.
 */
router.post('/daily/send-now', proxyLimiter, async (req, res) => {
  try {
    const result = await sendDailyReportForUser(req.user._id);

    return res.status(200).json({
      success: true,
      message: `Daily operations digest dispatched to ${req.user.email}`,
      provider: result.provider,
      summary: result.reportData?.summary
    });
  } catch (err) {
    console.error('[Send Daily Report Error]:', err.message);
    return res.status(500).json({
      success: false,
      error: err.message || 'Failed to dispatch daily report'
    });
  }
});

/**
 * PATCH /api/reports/daily/preferences
 * Updates user preferences for automated daily digest email.
 */
router.patch('/daily/preferences', async (req, res) => {
  try {
    const { enabled, hourUtc } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    if (!user.dailyReport) {
      user.dailyReport = { enabled: true, hourUtc: 9 };
    }

    if (typeof enabled === 'boolean') {
      user.dailyReport.enabled = enabled;
    }
    if (typeof hourUtc === 'number') {
      user.dailyReport.hourUtc = Math.min(23, Math.max(0, hourUtc));
    }

    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Daily report preferences updated',
      preferences: user.dailyReport
    });
  } catch (err) {
    console.error('[Update Report Preferences Error]:', err.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to update daily report preferences'
    });
  }
});

module.exports = router;
