const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address']
    },
    passwordHash: {
      type: String,
      required: [true, 'Password hash is required'],
      select: false // Never return passwordHash in standard queries
    },
    isVerified: {
      type: Boolean,
      default: false
    },
    verificationOtp: {
      type: String,
      select: false
    },
    verificationOtpExpires: {
      type: Date,
      select: false
    },
    resetPasswordOtp: {
      type: String,
      select: false
    },
    resetPasswordOtpExpires: {
      type: Date,
      select: false
    },
    lastOtpSentAt: {
      type: Date,
      select: false
    },
    dailyReport: {
      enabled: {
        type: Boolean,
        default: true
      },
      hourUtc: {
        type: Number,
        default: 9
      },
      lastSentAt: {
        type: Date,
        default: null
      }
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    passwordChangedAt: {
      type: Date,
      default: null
    },
    // AI & MCP Integration API Key (Encrypted in AES-256-GCM vault)
    apiKeyEncrypted: {
      ciphertext: { type: String, select: false },
      iv: { type: String, select: false },
      authTag: { type: String, select: false }
    },
    apiKeyHash: {
      type: String,
      index: true,
      sparse: true,
      select: false
    },
    apiKeyLast4: {
      type: String,
      default: null
    },
    apiKeyCreatedAt: {
      type: Date,
      default: null
    },
    apiKeyLastUsedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: false,
    toJSON: {
      transform(doc, ret) {
        delete ret.passwordHash;
        delete ret.verificationOtp;
        delete ret.verificationOtpExpires;
        delete ret.resetPasswordOtp;
        delete ret.resetPasswordOtpExpires;
        delete ret.lastOtpSentAt;
        delete ret.apiKeyEncrypted;
        delete ret.apiKeyHash;
        delete ret.__v;
        return ret;
      }
    }
  }
);

// Helper method to compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

// Static helper to hash password
userSchema.statics.hashPassword = async function (password) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

// Generates a 6-digit registration verification OTP (valid for 10 minutes)
userSchema.methods.createVerificationOtp = function () {
  const otp = crypto.randomInt(100000, 999999).toString();
  this.verificationOtp = crypto.createHash('sha256').update(otp).digest('hex');
  this.verificationOtpExpires = new Date(Date.now() + 10 * 60 * 1000);
  this.lastOtpSentAt = new Date();
  return otp;
};

// Validates incoming candidate verification OTP
userSchema.methods.verifyOtp = function (candidateOtp) {
  if (!this.verificationOtp || !this.verificationOtpExpires) return false;
  if (Date.now() > new Date(this.verificationOtpExpires).getTime()) return false;
  const hash = crypto.createHash('sha256').update(String(candidateOtp).trim()).digest('hex');
  return hash === this.verificationOtp;
};

// Generates a 6-digit password reset OTP (valid for 10 minutes)
userSchema.methods.createResetPasswordOtp = function () {
  const otp = crypto.randomInt(100000, 999999).toString();
  this.resetPasswordOtp = crypto.createHash('sha256').update(otp).digest('hex');
  this.resetPasswordOtpExpires = new Date(Date.now() + 10 * 60 * 1000);
  this.lastOtpSentAt = new Date();
  return otp;
};

// Validates incoming candidate password reset OTP
userSchema.methods.verifyResetOtp = function (candidateOtp) {
  if (!this.resetPasswordOtp || !this.resetPasswordOtpExpires) return false;
  if (Date.now() > new Date(this.resetPasswordOtpExpires).getTime()) return false;
  const hash = crypto.createHash('sha256').update(String(candidateOtp).trim()).digest('hex');
  return hash === this.resetPasswordOtp;
};

const User = mongoose.model('User', userSchema);

module.exports = User;
