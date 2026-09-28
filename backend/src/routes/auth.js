const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const config = require('../config/config');
const { authLimiter } = require('../middleware/rateLimiter');
const { authenticateToken } = require('../middleware/auth');
const { sendVerificationOtp, sendPasswordResetOtp } = require('../utils/emailService');

const router = express.Router();

// Generate standard JWT token for user
function generateToken(user) {
  return jwt.sign(
    { id: user._id, email: user.email },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );
}

/**
 * POST /api/auth/register
 * Register a new administrator account and dispatch a 6-digit verification OTP.
 */
router.post('/register', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }

    if (typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters long'
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    let user = await User.findOne({ email: normalizedEmail }).select('+passwordHash +lastOtpSentAt');

    if (user && user.isVerified) {
      return res.status(409).json({
        success: false,
        error: 'An account with this email already exists and is verified. Please log in.'
      });
    }

    const passwordHash = await User.hashPassword(password);

    if (user && !user.isVerified) {
      // User registered before but did not verify — update credentials and issue new OTP
      user.passwordHash = passwordHash;
    } else {
      user = new User({
        email: normalizedEmail,
        passwordHash,
        isVerified: false
      });
    }

    const otp = user.createVerificationOtp();
    await user.save();

    // Dispatch verification OTP via Brevo / SMTP / Console fallback
    await sendVerificationOtp(user.email, otp);

    return res.status(201).json({
      success: true,
      requiresVerification: true,
      message: 'Registration initiated. A 6-digit verification code has been sent to your email.',
      email: user.email
    });
  } catch (error) {
    console.error('[Auth Register Error]:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to create account. Please try again.'
    });
  }
});

/**
 * POST /api/auth/verify-otp
 * Verify 6-digit registration OTP to activate account and return JWT session.
 */
router.post('/verify-otp', authLimiter, async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        error: 'Email and 6-digit verification code are required'
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail }).select('+verificationOtp +verificationOtpExpires');

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Account not found. Please register first.'
      });
    }

    if (user.isVerified) {
      const token = generateToken(user);
      return res.status(200).json({
        success: true,
        message: 'Account is already verified. Logged in successfully.',
        token,
        user: {
          id: user._id,
          email: user.email,
          isVerified: true,
          createdAt: user.createdAt
        }
      });
    }

    const isValid = user.verifyOtp(otp);
    if (!isValid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired verification code. Please request a new one.'
      });
    }

    user.isVerified = true;
    user.verificationOtp = undefined;
    user.verificationOtpExpires = undefined;
    await user.save();

    const token = generateToken(user);

    return res.status(200).json({
      success: true,
      message: 'Email verified successfully. Welcome to PanelHub!',
      token,
      user: {
        id: user._id,
        email: user.email,
        isVerified: true,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('[Verify OTP Error]:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to verify code. Please try again.'
    });
  }
});

/**
 * POST /api/auth/resend-otp
 * Resend a fresh 6-digit verification code (subject to 60-second cooldown).
 */
router.post('/resend-otp', authLimiter, async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail }).select('+lastOtpSentAt');

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'No account found with this email'
      });
    }

    if (user.isVerified) {
      return res.status(400).json({
        success: false,
        error: 'This account is already verified. Please log in directly.'
      });
    }

    // Enforce 60-second cooldown
    if (user.lastOtpSentAt) {
      const elapsed = Date.now() - new Date(user.lastOtpSentAt).getTime();
      if (elapsed < 60000) {
        const remainingSec = Math.ceil((60000 - elapsed) / 1000);
        return res.status(429).json({
          success: false,
          error: `Please wait ${remainingSec} seconds before requesting a new code.`
        });
      }
    }

    const otp = user.createVerificationOtp();
    await user.save();

    await sendVerificationOtp(user.email, otp);

    return res.status(200).json({
      success: true,
      message: 'A fresh 6-digit verification code has been dispatched to your email.'
    });
  } catch (error) {
    console.error('[Resend OTP Error]:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to resend code. Please try again.'
    });
  }
});

/**
 * POST /api/auth/login
 * Authenticate existing administrator account.
 */
router.post('/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail }).select('+passwordHash +lastOtpSentAt');
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    // If user registered but never verified their email, require OTP verification
    if (user.isVerified === false) {
      // Send a fresh OTP if not sent recently
      const elapsed = user.lastOtpSentAt ? Date.now() - new Date(user.lastOtpSentAt).getTime() : 999999;
      if (elapsed > 60000) {
        const otp = user.createVerificationOtp();
        await user.save();
        await sendVerificationOtp(user.email, otp);
      }

      return res.status(403).json({
        success: false,
        requiresVerification: true,
        email: user.email,
        error: 'Your email address is not verified yet. A verification code has been sent to your inbox.'
      });
    }

    const token = generateToken(user);

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        email: user.email,
        isVerified: user.isVerified !== false,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('[Auth Login Error]:', error.message);
    return res.status(500).json({
      success: false,
      error: 'An unexpected error occurred during login.'
    });
  }
});

/**
 * POST /api/auth/forgot-password
 * Initiates password reset by emailing a 6-digit reset OTP.
 */
router.post('/forgot-password', authLimiter, async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail }).select('+lastOtpSentAt');

    // Generic safe response to prevent email enumeration
    const genericResponse = {
      success: true,
      message: 'If an account exists with this email, a 6-digit password reset code has been sent.'
    };

    if (!user) {
      return res.status(200).json(genericResponse);
    }

    // Cooldown check (60s)
    if (user.lastOtpSentAt) {
      const elapsed = Date.now() - new Date(user.lastOtpSentAt).getTime();
      if (elapsed < 60000) {
        const remainingSec = Math.ceil((60000 - elapsed) / 1000);
        return res.status(429).json({
          success: false,
          error: `Please wait ${remainingSec} seconds before requesting another code.`
        });
      }
    }

    const otp = user.createResetPasswordOtp();
    await user.save();

    await sendPasswordResetOtp(user.email, otp);

    return res.status(200).json(genericResponse);
  } catch (error) {
    console.error('[Forgot Password Error]:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to process password reset. Please try again.'
    });
  }
});

/**
 * POST /api/auth/reset-password
 * Reset password using the 6-digit reset OTP.
 */
router.post('/reset-password', authLimiter, async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Email, verification code, and new password are required'
      });
    }

    if (typeof newPassword !== 'string' || newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'New password must be at least 6 characters long'
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail }).select('+resetPasswordOtp +resetPasswordOtpExpires');

    if (!user) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired password reset code.'
      });
    }

    const isValid = user.verifyResetOtp(otp);
    if (!isValid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired password reset code. Please request a new one.'
      });
    }

    user.passwordHash = await User.hashPassword(newPassword);
    user.resetPasswordOtp = undefined;
    user.resetPasswordOtpExpires = undefined;
    user.isVerified = true; // Successfully verifying through email confirms ownership
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Password reset successfully! You can now log in with your new password.'
    });
  } catch (error) {
    console.error('[Reset Password Error]:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to reset password. Please try again.'
    });
  }
});

/**
 * GET /api/auth/me
 * Returns current authenticated user profile.
 */
router.get('/me', authenticateToken, async (req, res) => {
  return res.status(200).json({
    success: true,
    user: {
      id: req.user._id,
      email: req.user.email,
      isVerified: req.user.isVerified !== false,
      createdAt: req.user.createdAt
    }
  });
});

module.exports = router;
