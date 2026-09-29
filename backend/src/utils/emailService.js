/**
 * emailService.js
 * Transports transactional emails (Verification OTP, Password Reset OTP)
 * Supports Brevo REST API (api.brevo.com), SMTP (smtp-relay.brevo.com), or dev console fallback.
 */

const axios = require('axios');
const nodemailer = require('nodemailer');

function getEmailSender() {
  const email = process.env.EMAIL_FROM || 'noreply@panelhub.com';
  const name = process.env.EMAIL_FROM_NAME || 'PanelHub Security';
  return { name, email };
}

function getEmailTemplate({ title, subtitle, otp, warning, note }) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #090d16; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f1f5f9;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #090d16; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 480px; background: #0f172a; border: 1px solid #1e293b; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);">
          <!-- Header -->
          <tr>
            <td style="padding: 32px 32px 20px 32px; text-align: center; border-bottom: 1px solid #1e293b;">
              <div style="display: inline-block; padding: 10px 14px; background: rgba(99, 102, 241, 0.15); border: 1px solid rgba(99, 102, 241, 0.3); border-radius: 12px; margin-bottom: 16px;">
                <span style="font-size: 20px; font-weight: 800; color: #818cf8; letter-spacing: -0.5px;">Panel<span style="color: #ffffff;">Hub</span></span>
              </div>
              <h1 style="margin: 0; font-size: 20px; font-weight: 700; color: #ffffff;">${title}</h1>
              <p style="margin: 8px 0 0 0; font-size: 13px; color: #94a3b8;">${subtitle}</p>
            </td>
          </tr>

          <!-- OTP Box -->
          <tr>
            <td style="padding: 32px; text-align: center;">
              <p style="margin: 0 0 16px 0; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: #64748b;">
                Your One-Time Security Code
              </p>

              <div style="background: #1e1b4b; border: 2px dashed #6366f1; border-radius: 12px; padding: 18px 24px; margin: 0 auto; display: inline-block;">
                <span style="font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #a5b4fc;">
                  ${otp}
                </span>
              </div>

              <p style="margin: 18px 0 0 0; font-size: 12px; color: #94a3b8;">
                ⏱️ This code is valid for <strong>10 minutes</strong>. Do not share it with anyone.
              </p>

              ${warning ? `
              <div style="margin-top: 24px; padding: 12px 16px; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 8px; text-align: left;">
                <p style="margin: 0; font-size: 11px; color: #f87171; line-height: 1.5;">${warning}</p>
              </div>` : ''}

              ${note ? `<p style="margin: 16px 0 0 0; font-size: 11px; color: #64748b; line-height: 1.5;">${note}</p>` : ''}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 32px; background: #090d16; border-top: 1px solid #1e293b; text-align: center;">
              <p style="margin: 0; font-size: 11px; color: #475569;">
                Protected by PanelHub Multi-Tenant Encryption &bull; AES-256-GCM
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Dispatches an email via Brevo REST API, SMTP, or Dev Console.
 */
async function sendEmail({ to, subject, html, text }) {
  // Never consume production Brevo email quota during test suite execution
  if (process.env.NODE_ENV === 'test') {
    return { success: true, messageId: 'test-mock-msg-id', provider: 'test_mock' };
  }

  const sender = getEmailSender();
  const brevoApiKey = process.env.BREVO_API_KEY;

  // 1. Try Brevo REST API (HTTPS - fast and bypasses cloud SMTP port blocks)
  if (brevoApiKey && brevoApiKey.trim() !== '') {
    try {
      const response = await axios.post(
        'https://api.brevo.com/v3/smtp/email',
        {
          sender: { name: sender.name, email: sender.email },
          to: [{ email: to }],
          subject,
          htmlContent: html,
          textContent: text || subject
        },
        {
          headers: {
            'api-key': brevoApiKey.trim(),
            'Content-Type': 'application/json',
            Accept: 'application/json'
          },
          timeout: 10000
        }
      );
      return { success: true, messageId: response.data?.messageId, provider: 'brevo_api' };
    } catch (err) {
      console.error('[Brevo API Error]:', err.response?.data || err.message);
      // Fall through to SMTP or console if Brevo API errored
    }
  }

  // 2. Try SMTP Transport (Brevo SMTP or standard SMTP)
  const smtpHost = process.env.SMTP_HOST || 'smtp-relay.brevo.com';
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS || process.env.BREVO_SMTP_KEY;

  if (smtpUser && smtpPass) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: Number(process.env.SMTP_PORT) === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass
        }
      });

      const info = await transporter.sendMail({
        from: `"${sender.name}" <${sender.email}>`,
        to,
        subject,
        html,
        text: text || subject
      });
      return { success: true, messageId: info.messageId, provider: 'smtp' };
    } catch (err) {
      console.error('[SMTP Send Error]:', err.message);
    }
  }

  // 3. Fallback: Local / Dev Console Simulation
  console.log('\n============================================================');
  console.log(`[PANELHUB EMAIL - DEV CONSOLE FALLBACK]`);
  console.log(`To: ${to}`);
  console.log(`Subject: ${subject}`);
  console.log(`Body:\n${text || 'HTML Email Body Generated'}`);
  console.log('============================================================\n');

  return { success: true, provider: 'console_fallback' };
}

/**
 * Sends a 6-digit email verification OTP to a newly registered user.
 */
async function sendVerificationOtp(email, otp) {
  const subject = `Your PanelHub Verification Code: ${otp}`;
  const html = getEmailTemplate({
    title: 'Verify Your Email Address',
    subtitle: 'Welcome to PanelHub! Please confirm your email to activate your account.',
    otp,
    warning: 'If you did not create a PanelHub account, no action is required.',
    note: 'For your security, never share this code with anyone.'
  });

  const text = `Welcome to PanelHub!\n\nYour 6-digit verification code is: ${otp}\n\nThis code is valid for 10 minutes.\nIf you did not request this, please ignore this email.`;
  return sendEmail({ to: email, subject, html, text });
}

/**
 * Sends a 6-digit password reset OTP to an admin user.
 */
async function sendPasswordResetOtp(email, otp) {
  const subject = `Reset Your Password - Code: ${otp}`;
  const html = getEmailTemplate({
    title: 'Password Reset Request',
    subtitle: 'We received a request to reset your PanelHub account password.',
    otp,
    warning: 'SECURITY WARNING: If you did not request a password reset, someone may be attempting to access your account. Please change your credentials immediately.',
    note: 'Your connected 3x-ui panels and servers will remain securely encrypted and intact.'
  });

  const text = `PanelHub Password Reset\n\nYour 6-digit password reset code is: ${otp}\n\nThis code expires in 10 minutes.\nIf you did not request this, please ignore this message.`;
  return sendEmail({ to: email, subject, html, text });
}

/**
 * Formats a clean alert email for server downtime, recovery, and resource thresholds.
 */
function getAlertEmailTemplate({ badgeColor, badgeText, title, subtitle, serverName, serverUrl, error, detailsHtml, recommendations }) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #090d16; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f1f5f9;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #090d16; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 520px; background: #0f172a; border: 1px solid #1e293b; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);">
          <!-- Header -->
          <tr>
            <td style="padding: 28px 32px 20px 32px; text-align: left; border-bottom: 1px solid #1e293b;">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
                <span style="font-size: 16px; font-weight: 800; color: #818cf8; letter-spacing: -0.5px;">Panel<span style="color: #ffffff;">Hub</span> Monitoring</span>
                <span style="display: inline-block; padding: 4px 10px; background: ${badgeColor}22; border: 1px solid ${badgeColor}66; border-radius: 20px; font-size: 11px; font-weight: 700; color: ${badgeColor}; text-transform: uppercase; letter-spacing: 0.5px;">
                  ${badgeText}
                </span>
              </div>
              <h1 style="margin: 0; font-size: 20px; font-weight: 700; color: #ffffff;">${title}</h1>
              <p style="margin: 6px 0 0 0; font-size: 13px; color: #94a3b8;">${subtitle}</p>
            </td>
          </tr>

          <!-- Server Info Card -->
          <tr>
            <td style="padding: 24px 32px;">
              <table role="presentation" width="100%" style="background: #1e293b; border-radius: 10px; padding: 14px 18px; margin-bottom: 20px;">
                <tr>
                  <td style="font-size: 12px; color: #94a3b8; padding-bottom: 4px;">Server Instance</td>
                </tr>
                <tr>
                  <td style="font-size: 16px; font-weight: 700; color: #f8fafc; font-family: monospace;">${serverName}</td>
                </tr>
                <tr>
                  <td style="font-size: 12px; color: #64748b; padding-top: 4px; word-break: break-all;">${serverUrl}</td>
                </tr>
              </table>

              ${error ? `
              <div style="margin-bottom: 20px; padding: 14px; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 10px;">
                <p style="margin: 0 0 4px 0; font-size: 11px; font-weight: 700; text-transform: uppercase; color: #f87171; letter-spacing: 0.5px;">Detected Incident</p>
                <p style="margin: 0; font-size: 13px; color: #fca5a5; font-family: monospace; word-break: break-all;">${error}</p>
              </div>` : ''}

              ${detailsHtml || ''}

              ${recommendations ? `
              <div style="margin-top: 16px; padding: 14px; background: rgba(99, 102, 241, 0.08); border: 1px solid rgba(99, 102, 241, 0.2); border-radius: 10px;">
                <p style="margin: 0 0 6px 0; font-size: 11px; font-weight: 700; text-transform: uppercase; color: #a5b4fc; letter-spacing: 0.5px;">Suggested Action</p>
                <p style="margin: 0; font-size: 12px; color: #cbd5e1; line-height: 1.5;">${recommendations}</p>
              </div>` : ''}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 16px 32px; background: #090d16; border-top: 1px solid #1e293b; text-align: center;">
              <p style="margin: 0; font-size: 11px; color: #475569;">
                PanelHub Automated Health Monitor &bull; Sent to ${serverName} Administrator
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Sends a high-priority Down alert when a 3x-ui server is offline or unreachable.
 */
async function sendServerDownAlert({ to, server, error }) {
  const subject = `🚨 [PanelHub Alert] Server Down: "${server.nickname}" is unreachable`;
  const timeStr = new Date().toUTCString();

  const html = getAlertEmailTemplate({
    badgeColor: '#ef4444',
    badgeText: 'CRITICAL &bull; OFFLINE',
    title: 'Server Offline Detected',
    subtitle: `PanelHub was unable to reach your 3x-ui instance at ${timeStr}.`,
    serverName: server.nickname,
    serverUrl: server.panelUrl,
    error: error || 'Connection refused or timed out',
    recommendations: '1. Check if your VPS provider (Azure/Alibaba/etc.) is running.<br>2. Verify port firewall rules allow inbound panel traffic.<br>3. SSH into the server and run <code>x-ui restart</code> or <code>x-ui status</code>.'
  });

  const text = `🚨 [PanelHub Alert] Server Down: ${server.nickname}\n\nServer "${server.nickname}" (${server.panelUrl}) is unreachable.\nTime: ${timeStr}\nError: ${error || 'Connection timed out'}\n\nPlease check your VPS instance and firewall settings.`;
  return sendEmail({ to, subject, html, text });
}

/**
 * Sends a recovery notification when a previously offline 3x-ui server returns online.
 */
async function sendServerRecoveredAlert({ to, server, downtimeMinutes }) {
  const subject = `✅ [PanelHub Restored] Server Recovered: "${server.nickname}" is back online`;
  const timeStr = new Date().toUTCString();
  const downtimeText = downtimeMinutes ? `after ~${Math.round(downtimeMinutes)} minutes of downtime` : 'and is now responding normally';

  const detailsHtml = `
  <div style="margin-bottom: 16px; padding: 14px; background: rgba(34, 197, 94, 0.1); border: 1px solid rgba(34, 197, 94, 0.3); border-radius: 10px;">
    <p style="margin: 0 0 4px 0; font-size: 11px; font-weight: 700; text-transform: uppercase; color: #4ade80; letter-spacing: 0.5px;">Service Recovery</p>
    <p style="margin: 0; font-size: 13px; color: #86efac;">The 3x-ui panel and Xray core are back online ${downtimeText}.</p>
  </div>`;

  const html = getAlertEmailTemplate({
    badgeColor: '#22c55e',
    badgeText: 'ONLINE &bull; RESOLVED',
    title: 'Server Restored Online',
    subtitle: `Connection to "${server.nickname}" re-established at ${timeStr}.`,
    serverName: server.nickname,
    serverUrl: server.panelUrl,
    detailsHtml,
    recommendations: 'All VPN inbounds and client connections are operational. No further administrative action required.'
  });

  const text = `✅ [PanelHub Restored] Server Recovered: ${server.nickname}\n\nServer "${server.nickname}" (${server.panelUrl}) is back online ${downtimeText}.\nTime: ${timeStr}`;
  return sendEmail({ to, subject, html, text });
}

/**
 * Sends a warning when server resources (CPU or RAM) exceed 90%.
 */
async function sendHighResourceAlert({ to, server, metrics }) {
  const subject = `⚠️ [PanelHub Warning] High Resource Usage on "${server.nickname}"`;
  const timeStr = new Date().toUTCString();

  const detailsHtml = `
  <table role="presentation" width="100%" style="background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 10px; padding: 12px; margin-bottom: 16px;">
    <tr>
      <td style="font-size: 12px; color: #fcd34d; font-weight: 600;">CPU Usage:</td>
      <td style="font-size: 13px; color: #fbbf24; font-weight: 700; text-align: right; font-family: monospace;">${metrics.cpu}%</td>
    </tr>
    <tr>
      <td style="font-size: 12px; color: #fcd34d; font-weight: 600; padding-top: 6px;">RAM Usage:</td>
      <td style="font-size: 13px; color: #fbbf24; font-weight: 700; text-align: right; font-family: monospace; padding-top: 6px;">${metrics.memPercent}% (${metrics.memUsedMB} MB / ${metrics.memTotalMB} MB)</td>
    </tr>
  </table>`;

  const html = getAlertEmailTemplate({
    badgeColor: '#f59e0b',
    badgeText: 'WARNING &bull; HIGH LOAD',
    title: 'High Resource Usage Detected',
    subtitle: `Server "${server.nickname}" exceeded 90% resource utilization at ${timeStr}.`,
    serverName: server.nickname,
    serverUrl: server.panelUrl,
    detailsHtml,
    recommendations: 'Check active concurrent VPN clients or consider upgrading VPS CPU/RAM if high traffic is expected.'
  });

  const text = `⚠️ [PanelHub Warning] High Resource Usage: ${server.nickname}\n\nCPU: ${metrics.cpu}%\nRAM: ${metrics.memPercent}%\nTime: ${timeStr}`;
  return sendEmail({ to, subject, html, text });
}

/**
 * Sends a dedicated test confirmation email to verify Brevo delivery without causing false alarms.
 */
async function sendTestAlertEmail({ to, server }) {
  const subject = `🧪 [TEST] PanelHub Alert Delivery Verified: "${server.nickname}"`;
  const timeStr = new Date().toUTCString();

  const detailsHtml = `
  <div style="margin-bottom: 16px; padding: 14px; background: rgba(99, 102, 241, 0.1); border: 1px solid rgba(99, 102, 241, 0.3); border-radius: 10px;">
    <p style="margin: 0 0 4px 0; font-size: 11px; font-weight: 700; text-transform: uppercase; color: #818cf8; letter-spacing: 0.5px;">Simulated System Check</p>
    <p style="margin: 0; font-size: 13px; color: #c7d2fe;">This is a test notification triggered from your PanelHub settings. Your server is completely <strong>ONLINE</strong> and operating normally. No action required.</p>
  </div>`;

  const html = getAlertEmailTemplate({
    badgeColor: '#6366f1',
    badgeText: 'TEST &bull; VERIFICATION',
    title: 'Test Alert Delivery Successful',
    subtitle: `Generated from your PanelHub notification settings at ${timeStr}.`,
    serverName: server.nickname,
    serverUrl: server.panelUrl,
    detailsHtml,
    recommendations: 'Your Brevo email integration is working perfectly! You will receive automatic alerts based on your configured triggers (Down, Recover, or High Resource).'
  });

  const text = `🧪 [TEST] PanelHub Alert Delivery Verified: "${server.nickname}"\n\nThis is a test notification requested from your dashboard.\nServer: ${server.nickname} (${server.panelUrl})\nStatus: ONLINE & Operational\nTime: ${timeStr}\n\nYour Brevo email integration is verified and working!`;
  return sendEmail({ to, subject, html, text });
}

/**
 * Sends a scheduled daily operations, bandwidth, and health summary report.
 */
async function sendDailyReportEmail({ to, dateStr, summary, serverBreakdown }) {
  const subject = `📊 [PanelHub] Daily Operations & Health Digest - ${dateStr}`;

  const serverRowsHtml = serverBreakdown.map(s => `
    <tr style="border-bottom: 1px solid #1e293b;">
      <td style="padding: 12px 10px; font-weight: 600; color: #f1f5f9; font-size: 13px;">
        ${s.nickname}
        <div style="font-size: 11px; color: #64748b; font-family: monospace;">${s.panelUrl}</div>
      </td>
      <td style="padding: 12px 10px; text-align: center;">
        <span style="display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 700; ${s.status === 'online' ? 'background: rgba(34, 197, 94, 0.15); color: #4ade80; border: 1px solid rgba(34, 197, 94, 0.3);' : 'background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3);'}">
          ${s.status.toUpperCase()}
        </span>
      </td>
      <td style="padding: 12px 10px; text-align: center; font-size: 12px; font-family: monospace; color: #cbd5e1;">
        CPU: ${s.cpu}%<br>RAM: ${s.mem}%
      </td>
      <td style="padding: 12px 10px; text-align: center; font-size: 12px; color: #cbd5e1;">
        ${s.inbounds} inbounds<br><span style="color: #818cf8; font-weight: 600;">${s.clients} clients</span>
      </td>
      <td style="padding: 12px 10px; text-align: right; font-size: 12px; font-family: monospace; color: #a5b4fc;">
        ${s.traffic}
      </td>
    </tr>
  `).join('');

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #090d16; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f1f5f9;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #090d16; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 620px; background: #0f172a; border: 1px solid #1e293b; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);">
          <!-- Header -->
          <tr>
            <td style="padding: 28px 32px 20px 32px; border-bottom: 1px solid #1e293b; text-align: left;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <span style="font-size: 18px; font-weight: 800; color: #818cf8; letter-spacing: -0.5px;">Panel<span style="color: #ffffff;">Hub</span> Digest</span>
                <span style="font-size: 11px; font-weight: 600; color: #94a3b8; background: #1e293b; padding: 4px 10px; border-radius: 20px;">${dateStr}</span>
              </div>
              <h1 style="margin: 0; font-size: 20px; font-weight: 700; color: #ffffff;">Daily Operations & Health Report</h1>
              <p style="margin: 4px 0 0 0; font-size: 13px; color: #94a3b8;">Automated executive summary across your 3x-ui VPN nodes.</p>
            </td>
          </tr>

          <!-- Summary Metric Boxes -->
          <tr>
            <td style="padding: 24px 32px 16px 32px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td width="25%" style="padding: 6px;">
                    <div style="background: #1e293b; border: 1px solid #334155; border-radius: 10px; padding: 12px; text-align: center;">
                      <div style="font-size: 10px; color: #94a3b8; text-transform: uppercase; font-weight: 700;">Panels</div>
                      <div style="font-size: 20px; font-weight: 800; color: #38bdf8; margin-top: 4px;">${summary.onlinePanels}/${summary.totalPanels}</div>
                      <div style="font-size: 10px; color: #22c55e;">Online</div>
                    </div>
                  </td>
                  <td width="25%" style="padding: 6px;">
                    <div style="background: #1e293b; border: 1px solid #334155; border-radius: 10px; padding: 12px; text-align: center;">
                      <div style="font-size: 10px; color: #94a3b8; text-transform: uppercase; font-weight: 700;">Inbounds</div>
                      <div style="font-size: 20px; font-weight: 800; color: #818cf8; margin-top: 4px;">${summary.totalInbounds}</div>
                      <div style="font-size: 10px; color: #94a3b8;">Active ports</div>
                    </div>
                  </td>
                  <td width="25%" style="padding: 6px;">
                    <div style="background: #1e293b; border: 1px solid #334155; border-radius: 10px; padding: 12px; text-align: center;">
                      <div style="font-size: 10px; color: #94a3b8; text-transform: uppercase; font-weight: 700;">Clients</div>
                      <div style="font-size: 20px; font-weight: 800; color: #a855f7; margin-top: 4px;">${summary.totalClients}</div>
                      <div style="font-size: 10px; color: #94a3b8;">Provisioned</div>
                    </div>
                  </td>
                  <td width="25%" style="padding: 6px;">
                    <div style="background: #1e293b; border: 1px solid #334155; border-radius: 10px; padding: 12px; text-align: center;">
                      <div style="font-size: 10px; color: #94a3b8; text-transform: uppercase; font-weight: 700;">Bandwidth</div>
                      <div style="font-size: 16px; font-weight: 800; color: #34d399; margin-top: 4px;">${summary.totalTraffic}</div>
                      <div style="font-size: 10px; color: #94a3b8;">Cumulative</div>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Nodes Breakdown Table -->
          <tr>
            <td style="padding: 8px 32px 24px 32px;">
              <h3 style="margin: 0 0 12px 0; font-size: 13px; font-weight: 700; color: #e2e8f0; text-transform: uppercase; letter-spacing: 0.5px;">Node Health & Status</h3>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: #090d16; border: 1px solid #1e293b; border-radius: 10px; border-collapse: collapse; overflow: hidden;">
                <thead>
                  <tr style="background: #1e293b; text-align: left; font-size: 10px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px;">
                    <th style="padding: 10px;">Node</th>
                    <th style="padding: 10px; text-align: center;">Status</th>
                    <th style="padding: 10px; text-align: center;">Resources</th>
                    <th style="padding: 10px; text-align: center;">Capacity</th>
                    <th style="padding: 10px; text-align: right;">Traffic</th>
                  </tr>
                </thead>
                <tbody>
                  ${serverRowsHtml}
                </tbody>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 18px 32px; background: #090d16; border-top: 1px solid #1e293b; text-align: center;">
              <p style="margin: 0; font-size: 11px; color: #64748b;">
                PanelHub Daily Operations Monitor &bull; Delivered via Brevo API
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const text = `📊 [PanelHub] Daily Operations & Health Digest - ${dateStr}\n\nSummary:\n- Panels: ${summary.onlinePanels}/${summary.totalPanels} Online\n- Inbounds: ${summary.totalInbounds}\n- Clients: ${summary.totalClients}\n- Cumulative Bandwidth: ${summary.totalTraffic}\n\nBreakdown:\n` +
    serverBreakdown.map(s => `- ${s.nickname} (${s.panelUrl}): [${s.status.toUpperCase()}] CPU: ${s.cpu}%, RAM: ${s.mem}%, Clients: ${s.clients}, Traffic: ${s.traffic}`).join('\n');

  return sendEmail({ to, subject, html, text });
}

/**
 * Dispatches an account password changed security notice.
 */
async function sendPasswordChangedNotification(to) {
  const subject = '🔒 Security Notice: Your PanelHub password was changed';
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Password Changed</title>
</head>
<body style="margin: 0; padding: 0; background-color: #090d16; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f1f5f9;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #090d16; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 480px; background: #0f172a; border: 1px solid #1e293b; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);">
          <tr>
            <td style="padding: 32px 32px 20px 32px; text-align: center; border-bottom: 1px solid #1e293b;">
              <div style="display: inline-block; padding: 10px 14px; background: rgba(99, 102, 241, 0.15); border: 1px solid rgba(99, 102, 241, 0.3); border-radius: 12px; margin-bottom: 16px;">
                <span style="font-size: 20px; font-weight: 800; color: #818cf8;">Panel<span style="color: #ffffff;">Hub</span></span>
              </div>
              <h1 style="margin: 0; font-size: 20px; font-weight: 700; color: #ffffff;">Password Changed Successfully</h1>
              <p style="margin: 8px 0 0 0; font-size: 13px; color: #94a3b8;">Security Notification for ${to}</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 28px 32px; text-align: left;">
              <p style="margin: 0 0 16px 0; font-size: 13px; color: #cbd5e1; line-height: 1.6;">
                The password for your PanelHub account (<strong>${to}</strong>) was recently updated.
              </p>
              <div style="padding: 14px 18px; background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.25); border-radius: 10px; margin-bottom: 20px;">
                <p style="margin: 0; font-size: 12px; color: #34d399; line-height: 1.5;">
                  ✔ If you performed this change, no further action is required.
                </p>
              </div>
              <p style="margin: 0; font-size: 12px; color: #94a3b8; line-height: 1.5;">
                If you did not authorize this change, please immediately reset your password using the "Forgot Password" link on the login page.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 18px 32px; background: #090d16; border-top: 1px solid #1e293b; text-align: center;">
              <p style="margin: 0; font-size: 11px; color: #64748b;">
                Protected by PanelHub AES-256-GCM Vault &bull; Multi-Tenant Isolation
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const text = `🔒 [PanelHub Security Alert]\n\nThe password for your PanelHub account (${to}) was changed successfully.\n\nIf you made this change, no action is needed.\nIf you did not make this change, please immediately perform a password reset.`;

  return sendEmail({ to, subject, html, text });
}

/**
 * Dispatches an account deletion confirmation notice.
 */
async function sendAccountDeletedNotification(to) {
  const subject = '⚠️ Account Deleted: PanelHub Confirmation';
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Account Deleted</title>
</head>
<body style="margin: 0; padding: 0; background-color: #090d16; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f1f5f9;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #090d16; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 480px; background: #0f172a; border: 1px solid #1e293b; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);">
          <tr>
            <td style="padding: 32px 32px 20px 32px; text-align: center; border-bottom: 1px solid #1e293b;">
              <div style="display: inline-block; padding: 10px 14px; background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 12px; margin-bottom: 16px;">
                <span style="font-size: 20px; font-weight: 800; color: #f87171;">Panel<span style="color: #ffffff;">Hub</span></span>
              </div>
              <h1 style="margin: 0; font-size: 20px; font-weight: 700; color: #ffffff;">Account Successfully Deleted</h1>
              <p style="margin: 8px 0 0 0; font-size: 13px; color: #94a3b8;">Confirmation for ${to}</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 28px 32px; text-align: left;">
              <p style="margin: 0 0 16px 0; font-size: 13px; color: #cbd5e1; line-height: 1.6;">
                Your PanelHub tenant account (<strong>${to}</strong>) and all encrypted 3x-ui node configurations have been permanently deleted from our database.
              </p>
              <p style="margin: 0; font-size: 12px; color: #94a3b8; line-height: 1.5;">
                Your remote servers continue running untouched. If you wish to use PanelHub again in the future, you may register a new account at any time.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 18px 32px; background: #090d16; border-top: 1px solid #1e293b; text-align: center;">
              <p style="margin: 0; font-size: 11px; color: #64748b;">
                PanelHub Security &bull; Zero DB residual client data
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const text = `⚠️ [PanelHub Confirmation]\n\nYour PanelHub account (${to}) and all encrypted server credentials have been permanently deleted.\n\nThank you for using PanelHub.`;

  return sendEmail({ to, subject, html, text });
}

module.exports = {
  sendEmail,
  sendVerificationOtp,
  sendPasswordResetOtp,
  sendServerDownAlert,
  sendServerRecoveredAlert,
  sendHighResourceAlert,
  sendTestAlertEmail,
  sendDailyReportEmail,
  sendPasswordChangedNotification,
  sendAccountDeletedNotification
};
