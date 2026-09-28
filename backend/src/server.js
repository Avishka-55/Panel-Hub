const app = require('./app');
const config = require('./config/config');
const { connectDB } = require('./config/db');
const { createMock3xUiServer } = require('./services/mockPanelServer');

const { startHealthMonitor, stopHealthMonitor } = require('./services/healthMonitorService');
const { startDailyReportScheduler, stopDailyReportScheduler } = require('./services/dailyReportService');

let serverInstance;
let mockPanelInstance;

async function startServer() {
  try {
    // Connect to MongoDB
    await connectDB();

    // Start Autonomous Health & Telemetry Monitor (5 minutes default)
    const checkIntervalMinutes = parseInt(process.env.HEALTH_CHECK_INTERVAL_MINUTES || '5', 10);
    startHealthMonitor(checkIntervalMinutes);

    // Start Scheduled Daily Operations & Health Report Scheduler
    startDailyReportScheduler();

    // In development mode, also optionally launch a mock 3x-ui panel for immediate out-of-the-box testing
    if (process.env.START_MOCK_PANEL === 'true' || config.nodeEnv === 'development') {
      const mockPort = parseInt(process.env.MOCK_PANEL_PORT || '2053', 10);
      try {
        mockPanelInstance = await createMock3xUiServer(mockPort, 'admin', 'password123');
        console.log(`[Mock 3x-ui Panel] Running at ${mockPanelInstance.url} (User: admin, Pass: password123)`);
      } catch (mockErr) {
        console.warn(`[Mock 3x-ui Panel] Could not start on port ${mockPort}: ${mockErr.message}`);
      }
    }

    serverInstance = app.listen(config.port, () => {
      console.log(`[PanelHub Backend] Server listening on port ${config.port} (${config.nodeEnv})`);
      console.log(`[PanelHub Backend] Ready to manage 3x-ui panels!`);
    });
  } catch (error) {
    console.error('Fatal failure during server start:', error.message);
    process.exit(1);
  }
}

// Graceful shutdown
async function gracefulShutdown(signal) {
  console.log(`\nReceived ${signal}. Shutting down gracefully...`);
  stopHealthMonitor();
  stopDailyReportScheduler();
  if (serverInstance) {
    serverInstance.close(() => {
      console.log('HTTP server closed.');
    });
  }
  if (mockPanelInstance) {
    await mockPanelInstance.close();
    console.log('Mock 3x-ui server closed.');
  }
  const { disconnectDB } = require('./config/db');
  await disconnectDB();
  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

if (require.main === module) {
  startServer();
}

module.exports = { startServer };
