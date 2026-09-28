/**
 * healthMonitorService.js
 * Autonomous Background Health & Telemetry Monitor for 3x-ui Panels.
 * 
 * Periodically polls connected servers, updates telemetry (CPU, RAM, Disk, Uptime),
 * detects server downtime and service recovery, and sends Brevo email alerts.
 */

const Server = require('../models/Server');
const User = require('../models/User');
const { decrypt } = require('../utils/crypto');
const panelService = require('./panelService');
const emailService = require('../utils/emailService');

let monitorIntervalTimer = null;
let isCheckInProgress = false;

/**
 * Decrypts in-memory authentication configuration for the panel.
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
 * Checks a single server instance, updates its telemetry/status in DB,
 * and triggers down/recovered email alerts if applicable.
 */
async function checkServer(server) {
  const previousStatus = server.status;
  const previousAlertState = server.lastAlertState || 'none';
  const ownerEmail = server.ownerId?.email;
  const alertsEnabled = server.monitoring?.emailAlerts !== false;

  try {
    const authConfig = getDecryptedAuthConfig(server);
    
    // Attempt live server status inquiry
    let statusData = null;
    let errorMsg = null;

    try {
      statusData = await panelService.getServerStatus(server.panelUrl, authConfig);
    } catch (statusErr) {
      // If status endpoint failed, attempt connection test fallback
      try {
        const testRes = await panelService.testConnection(server.panelUrl, authConfig);
        if (testRes.success) {
          statusData = {
            cpu: 0,
            mem: { percent: 0, current: 0, total: 0 },
            disk: { percent: 0, current: 0, total: 0 },
            uptime: 0,
            xray: { state: 'running' }
          };
        }
      } catch (testErr) {
        errorMsg = statusErr.message || testErr.message;
      }
    }

    if (!statusData && errorMsg) {
      throw new Error(errorMsg);
    }

    // --- SUCCESS: SERVER IS ONLINE ---
    server.status = 'online';
    server.lastError = null;
    server.failureCount = 0;
    server.lastConnectedAt = new Date();
    server.lastCheckedAt = new Date();

    // Extract telemetry
    const cpuPercent = Number(statusData.cpu?.percent ?? statusData.cpu ?? 0);
    const memPercent = Number(statusData.mem?.percent ?? 0);
    const memUsed = Number(statusData.mem?.current ?? statusData.mem?.used ?? 0);
    const memTotal = Number(statusData.mem?.total ?? 0);
    const diskPercent = Number(statusData.disk?.percent ?? 0);
    const diskUsed = Number(statusData.disk?.current ?? statusData.disk?.used ?? 0);
    const diskTotal = Number(statusData.disk?.total ?? 0);
    const uptime = Number(statusData.uptime ?? 0);
    const xrayState = statusData.xray?.state || (statusData.xray?.status === 'running' ? 'running' : 'running');

    server.telemetry = {
      cpu: cpuPercent,
      memPercent,
      memUsed,
      memTotal,
      diskPercent,
      diskUsed,
      diskTotal,
      uptime,
      xrayState
    };

    // Check for Recovery Alert
    if (previousStatus === 'offline' || previousAlertState === 'down') {
      const downtimeMinutes = server.lastStatusChangeAt
        ? (Date.now() - new Date(server.lastStatusChangeAt).getTime()) / (60 * 1000)
        : 0;

      server.lastStatusChangeAt = new Date();
      server.lastAlertState = 'recovered';
      server.lastAlertSentAt = new Date();

      const shouldNotifyRecover = alertsEnabled && (server.monitoring?.notifyOnRecover !== false);
      if (shouldNotifyRecover && ownerEmail) {
        console.log(`[Health Monitor] Server "${server.nickname}" recovered! Sending recovery email to ${ownerEmail}...`);
        try {
          await emailService.sendServerRecoveredAlert({
            to: ownerEmail,
            server,
            downtimeMinutes
          });
        } catch (emailErr) {
          console.error('[Health Monitor Alert Error]:', emailErr.message);
        }
      }
    }

    // High Resource Alert (Optional, user configurable threshold)
    const shouldNotifyResource = alertsEnabled && (server.monitoring?.notifyOnHighResource === true);
    const cpuThreshold = server.monitoring?.cpuThreshold ?? 90;
    const ramThreshold = server.monitoring?.ramThreshold ?? 90;

    if (shouldNotifyResource && (cpuPercent >= cpuThreshold || memPercent >= ramThreshold) && ownerEmail) {
      const hoursSinceLastAlert = server.lastAlertSentAt
        ? (Date.now() - new Date(server.lastAlertSentAt).getTime()) / (1000 * 60 * 60)
        : 999;

      if (server.lastAlertState !== 'high_resource' || hoursSinceLastAlert > 4) {
        server.lastAlertState = 'high_resource';
        server.lastAlertSentAt = new Date();

        try {
          await emailService.sendHighResourceAlert({
            to: ownerEmail,
            server,
            metrics: {
              cpu: cpuPercent,
              memPercent,
              memUsedMB: Math.round(memUsed / (1024 * 1024)),
              memTotalMB: Math.round(memTotal / (1024 * 1024))
            }
          });
        } catch (emailErr) {
          console.error('[Health Monitor Alert Error]:', emailErr.message);
        }
      }
    }

    await server.save();
    return { serverId: server._id, nickname: server.nickname, status: 'online', telemetry: server.telemetry };

  } catch (err) {
    const isCryptoMismatch = err.message && (
      err.message.includes('decryption failed') ||
      err.message.includes('Master key mismatch') ||
      err.message.includes('Unsupported state') ||
      err.message.includes('unable to authenticate')
    );

    // --- FAILURE: SERVER IS OFFLINE / UNREACHABLE ---
    server.failureCount = (server.failureCount || 0) + 1;
    server.lastCheckedAt = new Date();
    server.lastError = isCryptoMismatch
      ? 'Credential decryption failed: Master key mismatch. Please re-enter panel credentials.'
      : err.message;

    // Transition to offline
    if (server.status !== 'offline') {
      server.status = 'offline';
      server.lastStatusChangeAt = new Date();
    }

    // Send Down Alert if not already alerted and threshold met (suppress if local crypto key mismatch)
    const shouldNotifyDown = alertsEnabled && (server.monitoring?.notifyOnDown !== false) && !isCryptoMismatch;
    const consecutiveThreshold = server.monitoring?.consecutiveFails ?? 1;

    if (shouldNotifyDown && ownerEmail && server.failureCount >= consecutiveThreshold && server.lastAlertState !== 'down') {
      server.lastAlertState = 'down';
      server.lastAlertSentAt = new Date();

      console.warn(`[Health Monitor] Server "${server.nickname}" is DOWN (${err.message})! Sending alert email to ${ownerEmail}...`);
      try {
        await emailService.sendServerDownAlert({
          to: ownerEmail,
          server,
          error: err.message
        });
      } catch (emailErr) {
        console.error('[Health Monitor Alert Error]:', emailErr.message);
      }
    } else if (isCryptoMismatch) {
      console.warn(`[Health Monitor] Server "${server.nickname}" skipped: Master encryption key mismatch.`);
    }

    await server.save();
    return { serverId: server._id, nickname: server.nickname, status: 'offline', error: err.message };
  }
}

/**
 * Checks all servers in the database (or filtered by owner).
 */
async function checkAllServers(ownerId = null) {
  const query = {
    'monitoring.enabled': { $ne: false }
  };
  if (ownerId) {
    query.ownerId = ownerId;
  }

  const servers = await Server.find(query)
    .populate('ownerId', 'email name')
    .select('+panelPasswordEncrypted +panelPasswordIv +panelPasswordAuthTag +panelApiKeyEncrypted +panelApiKeyIv +panelApiKeyAuthTag');

  const results = [];
  for (const server of servers) {
    const result = await checkServer(server);
    results.push(result);
  }

  return results;
}

/**
 * Routine runner triggered on periodic intervals.
 */
async function runHealthCheckSweep() {
  if (isCheckInProgress) {
    return;
  }
  isCheckInProgress = true;
  try {
    const results = await checkAllServers();
    const onlineCount = results.filter(r => r.status === 'online').length;
    const offlineCount = results.filter(r => r.status === 'offline').length;
    if (results.length > 0) {
      console.log(`[Health Monitor Sweep] Checked ${results.length} panels (Online: ${onlineCount}, Offline: ${offlineCount})`);
    }
  } catch (err) {
    console.error('[Health Monitor Sweep Error]:', err.message);
  } finally {
    isCheckInProgress = false;
  }
}

/**
 * Starts the autonomous health monitoring scheduler.
 */
function startHealthMonitor(intervalMinutes = 3) {
  if (monitorIntervalTimer) {
    clearInterval(monitorIntervalTimer);
  }

  const intervalMs = Math.max(1, intervalMinutes) * 60 * 1000;
  console.log(`[Health Monitor] Initialized autonomous health monitor (Polling every ${intervalMinutes} min)`);

  // Run initial sweep after 5 seconds to ensure DB is connected and warm
  setTimeout(() => {
    runHealthCheckSweep().catch(() => {});
  }, 5000);

  // Set recurring interval
  monitorIntervalTimer = setInterval(runHealthCheckSweep, intervalMs);
}

/**
 * Stops the autonomous health monitoring scheduler.
 */
function stopHealthMonitor() {
  if (monitorIntervalTimer) {
    clearInterval(monitorIntervalTimer);
    monitorIntervalTimer = null;
    console.log('[Health Monitor] Stopped health monitor timer.');
  }
}

module.exports = {
  checkServer,
  checkAllServers,
  startHealthMonitor,
  stopHealthMonitor,
  runHealthCheckSweep
};
