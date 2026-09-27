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
    panelUsername: {
      type: String,
      required: [true, 'Panel username is required'],
      trim: true
    },
    panelPasswordEncrypted: {
      type: String,
      required: [true, 'Encrypted panel password is required'],
      select: false // Never return in default queries
    },
    panelPasswordIv: {
      type: String,
      required: [true, 'Panel password IV is required'],
      select: false // Never return in default queries
    },
    panelPasswordAuthTag: {
      type: String,
      required: [true, 'Panel password Auth Tag is required'],
      select: false // Never return in default queries
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
    createdAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: false,
    toJSON: {
      transform(doc, ret) {
        // Enforce strict security: Never return any encrypted or raw credentials
        delete ret.panelPasswordEncrypted;
        delete ret.panelPasswordIv;
        delete ret.panelPasswordAuthTag;
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
