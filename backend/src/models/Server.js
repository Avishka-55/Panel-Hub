const mongoose = require('mongoose');

const serverSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Owner ID is required'],
      index: true
    },
    nickname: {
      type: String,
      required: [true, 'Server nickname is required'],
      trim: true,
      maxlength: [100, 'Nickname cannot exceed 100 characters']
    },
    panelUrl: {
      type: String,
      required: [true, 'Panel URL is required'],
      trim: true
    },
    authType: {
      type: String,
      enum: ['credentials', 'api_key'],
      default: 'credentials'
    },
    panelUsername: {
      type: String,
      trim: true,
      default: ''
    },
    // AES-256-GCM encrypted password fields
    panelPasswordEncrypted: {
      type: String,
      select: false // Never return in queries
    },
    panelPasswordIv: {
      type: String,
      select: false // Never return in queries
    },
    panelPasswordAuthTag: {
      type: String,
      select: false // Never return in queries
    },
    // AES-256-GCM encrypted API Key fields
    panelApiKeyEncrypted: {
      type: String,
      select: false // Never return in queries
    },
    panelApiKeyIv: {
      type: String,
      select: false // Never return in queries
    },
    panelApiKeyAuthTag: {
      type: String,
      select: false // Never return in queries
    },
    lastConnectedAt: {
      type: Date,
      default: null
    },
    status: {
      type: String,
      enum: ['online', 'offline', 'error', 'untested'],
      default: 'untested'
    },
    lastError: {
      type: String,
      default: null
    },
    inboundCount: {
      type: Number,
      default: 0
    },
    monitoring: {
      enabled: {
        type: Boolean,
        default: true
      },
      emailAlerts: {
        type: Boolean,
        default: true
      },
      notifyOnDown: {
        type: Boolean,
        default: true
      },
      notifyOnRecover: {
        type: Boolean,
        default: true
      },
      notifyOnHighResource: {
        type: Boolean,
        default: false
      },
      cpuThreshold: {
        type: Number,
        default: 90,
        min: 50,
        max: 99
      },
      ramThreshold: {
        type: Number,
        default: 90,
        min: 50,
        max: 99
      },
      consecutiveFails: {
        type: Number,
        default: 1,
        min: 1,
        max: 10
      }
    },
    telemetry: {
      cpu: { type: Number, default: 0 },
      memPercent: { type: Number, default: 0 },
      memUsed: { type: Number, default: 0 },
      memTotal: { type: Number, default: 0 },
      diskPercent: { type: Number, default: 0 },
      diskUsed: { type: Number, default: 0 },
      diskTotal: { type: Number, default: 0 },
      uptime: { type: Number, default: 0 },
      xrayState: { type: String, default: 'unknown' }
    },
    lastCheckedAt: {
      type: Date,
      default: null
    },
    lastStatusChangeAt: {
      type: Date,
      default: null
    },
    failureCount: {
      type: Number,
      default: 0
    },
    lastAlertSentAt: {
      type: Date,
      default: null
    },
    lastAlertState: {
      type: String,
      enum: ['none', 'down', 'high_resource', 'recovered'],
      default: 'none'
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: false,
    toJSON: {
      transform(doc, ret) {
        // Enforce strict security: Never return any raw or encrypted credentials/tokens
        delete ret.panelPasswordEncrypted;
        delete ret.panelPasswordIv;
        delete ret.panelPasswordAuthTag;
        delete ret.panelApiKeyEncrypted;
        delete ret.panelApiKeyIv;
        delete ret.panelApiKeyAuthTag;
        delete ret.__v;
        return ret;
      }
    }
  }
);

// Compound index to guarantee fast lookups by ownerId
serverSchema.index({ ownerId: 1, createdAt: -1 });

const Server = mongoose.model('Server', serverSchema);

module.exports = Server;
