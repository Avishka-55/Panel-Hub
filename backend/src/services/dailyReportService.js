/**
 * dailyReportService.js
 * Automated Daily Operations & Health Digest for PanelHub.
 * 
 * Aggregates server statuses, active inbounds, total clients, and cumulative bandwidth,
 * then dispatches a daily digest email to the admin via Brevo.
 */

const User = require('../models/User');
const Server = require('../models/Server');
const { decrypt } = require('../utils/crypto');
const panelService = require('./panelService');
const emailService = require('../utils/emailService');

let reportIntervalTimer = null;

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

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
 * Aggregates live data and generates the report payload for a specific user.
 */
async function generateReportDataForUser(user) {
  const servers = await Server.find({ ownerId: user._id })
    .select('+panelPasswordEncrypted +panelPasswordIv +panelPasswordAuthTag +panelApiKeyEncrypted +panelApiKeyIv +panelApiKeyAuthTag');

  let totalInbounds = 0;
  let totalClients = 0;
  let totalBytes = 0;
  let onlinePanels = 0;

  const serverBreakdown = [];

  for (const s of servers) {
    const isOnline = s.status === 'online';
    if (isOnline) onlinePanels++;

    let serverInboundsCount = s.inboundCount || 0;
    let serverClientsCount = 0;
    let serverBytes = 0;

    // Try fetching live inbounds and traffic if online
    if (isOnline) {
      try {
        const authConfig = getDecryptedAuthConfig(s);
        const inboundsRes = await panelService.getInbounds(s.panelUrl, authConfig);
        const inbounds = Array.isArray(inboundsRes) ? inboundsRes : (inboundsRes?.inbounds || []);
        serverInboundsCount = inbounds.length;

        for (const inb of inbounds) {
          const inboundUp = Number(inb.up) || 0;
          const inboundDown = Number(inb.down) || 0;
          const inboundTraffic = inboundUp + inboundDown;

          let clientStatsTraffic = 0;
          if (Array.isArray(inb.clientStats)) {
            for (const cs of inb.clientStats) {
              clientStatsTraffic += (Number(cs.up) || 0) + (Number(cs.down) || 0);
            }
          }
          serverBytes += Math.max(inboundTraffic, clientStatsTraffic);

          // Count clients (support precomputed clientCount, parsed settings, or clientStats array)
          let clientsInThisInbound = Number(inb.clientCount) || 0;
          if (!clientsInThisInbound && inb.settings) {
            try {
              const parsed = typeof inb.settings === 'string' ? JSON.parse(inb.settings) : inb.settings;
              if (Array.isArray(parsed.clients)) {
                clientsInThisInbound = parsed.clients.length;
              }
            } catch (_) {}
          }
          if (!clientsInThisInbound && Array.isArray(inb.clientStats)) {
            clientsInThisInbound = inb.clientStats.length;
          }
          serverClientsCount += clientsInThisInbound;
        }
      } catch (err) {
        console.warn(`[Daily Report] Could not fetch live inbounds for ${s.nickname}: ${err.message}`);
      }
    }

    totalInbounds += serverInboundsCount;
    totalClients += serverClientsCount;
    totalBytes += serverBytes;

    serverBreakdown.push({
      nickname: s.nickname,
      panelUrl: s.panelUrl,
      status: s.status,
      cpu: s.telemetry?.cpu ?? 0,
      mem: s.telemetry?.memPercent ?? 0,
      inbounds: serverInboundsCount,
      clients: serverClientsCount,
      traffic: formatBytes(serverBytes)
    });
  }

  const dateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return {
    dateStr,
    summary: {
      totalPanels: servers.length,
      onlinePanels,
      totalInbounds,
      totalClients,
      totalTraffic: formatBytes(totalBytes)
    },
    serverBreakdown
  };
}

/**
 * Dispatches the daily digest email to a user.
 */
async function sendDailyReportForUser(userId) {
  const user = await User.findById(userId);
  if (!user) throw new Error('User not found');

  const reportData = await generateReportDataForUser(user);
  const result = await emailService.sendDailyReportEmail({
    to: user.email,
    dateStr: reportData.dateStr,
    summary: reportData.summary,
    serverBreakdown: reportData.serverBreakdown
  });

  if (!user.dailyReport) {
    user.dailyReport = { enabled: true, hourUtc: 9 };
  }
  user.dailyReport.lastSentAt = new Date();
  await user.save();

  return { success: true, messageId: result.messageId, provider: result.provider, reportData };
}

/**
 * Checks all users and sends reports if their scheduled time has arrived.
 */
async function checkAndSendDailyReports() {
  try {
    const currentHour = new Date().getUTCHours();
    const users = await User.find({
      'dailyReport.enabled': { $ne: false }
    });

    for (const u of users) {
      const scheduledHour = u.dailyReport?.hourUtc ?? 9;
      const lastSent = u.dailyReport?.lastSentAt;

      const hoursSinceLast = lastSent
        ? (Date.now() - new Date(lastSent).getTime()) / (1000 * 60 * 60)
        : 999;

      // Trigger if hour matches and hasn't been sent in the last 20 hours
      if (currentHour >= scheduledHour && hoursSinceLast > 20) {
        console.log(`[Daily Report] Dispatching scheduled digest for ${u.email}...`);
        await sendDailyReportForUser(u._id);
      }
    }
  } catch (err) {
    console.error('[Daily Report Scheduler Error]:', err.message);
  }
}

/**
 * Starts the daily report background ticker (runs every 30 minutes).
 */
function startDailyReportScheduler() {
  if (reportIntervalTimer) clearInterval(reportIntervalTimer);
  console.log('[Daily Report] Initialized daily operations report scheduler');

  // Check periodically
  reportIntervalTimer = setInterval(checkAndSendDailyReports, 30 * 60 * 1000);
}

/**
 * Stops the daily report scheduler.
 */
function stopDailyReportScheduler() {
  if (reportIntervalTimer) {
    clearInterval(reportIntervalTimer);
    reportIntervalTimer = null;
    console.log('[Daily Report] Stopped daily report scheduler');
  }
}

module.exports = {
  generateReportDataForUser,
  sendDailyReportForUser,
  startDailyReportScheduler,
  stopDailyReportScheduler
};
