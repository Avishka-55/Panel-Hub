import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../api/client';
import {
  User,
  Key,
  Lock,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Mail,
  Shield,
  ShieldAlert,
  Eye,
  EyeOff,
  Loader2,
  Calendar,
  Server,
  RefreshCw,
  Send,
  X,
  Bot,
  Sparkles,
  Copy,
  Check,
  Terminal
} from 'lucide-react';

export default function AccountSettingsView({ serverCount = 0, onOpenDailyReport }) {
  const { user, logout } = useAuth();

  // Change Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [changePasswordSuccess, setChangePasswordSuccess] = useState(null);
  const [changePasswordError, setChangePasswordError] = useState(null);

  // Email OTP Reset alternative mode
  const [isOtpResetMode, setIsOtpResetMode] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpNewPassword, setOtpNewPassword] = useState('');
  const [showOtpNewPassword, setShowOtpNewPassword] = useState(false);
  const [resettingWithOtp, setResettingWithOtp] = useState(false);
  const [otpSuccess, setOtpSuccess] = useState(null);
  const [otpError, setOtpError] = useState(null);

  // AI & MCP Integration API Key state
  const [apiKeyData, setApiKeyData] = useState(null);
  const [loadingApiKey, setLoadingApiKey] = useState(true);
  const [showApiKey, setShowApiKey] = useState(false);
  const [copiedApiKey, setCopiedApiKey] = useState(false);
  const [copiedClaudeConfig, setCopiedClaudeConfig] = useState(false);
  const [copiedClaudeWebUrl, setCopiedClaudeWebUrl] = useState(false);
  const [generatingApiKey, setGeneratingApiKey] = useState(false);
  const [revokingApiKey, setRevokingApiKey] = useState(false);
  const [apiKeyMessage, setApiKeyMessage] = useState(null);
  const [apiKeyError, setApiKeyError] = useState(null);
  const [isRevokeModalOpen, setIsRevokeModalOpen] = useState(false);

  useEffect(() => {
    fetchApiKey();
  }, []);

  const fetchApiKey = async () => {
    try {
      setLoadingApiKey(true);
      const res = await authApi.getApiKey();
      if (res.success) {
        setApiKeyData(res);
      }
    } catch (err) {
      console.warn('Failed to load API key:', err);
    } finally {
      setLoadingApiKey(false);
    }
  };

  const handleGenerateApiKey = async () => {
    setGeneratingApiKey(true);
    setApiKeyError(null);
    setApiKeyMessage(null);
    try {
      const res = await authApi.generateApiKey();
      if (res.success) {
        setApiKeyData(res);
        setShowApiKey(true);
        setApiKeyMessage(res.message || 'New API key generated successfully!');
        setTimeout(() => setApiKeyMessage(null), 5000);
      } else {
        setApiKeyError(res.error || 'Failed to generate API key');
      }
    } catch (err) {
      setApiKeyError(err.response?.data?.error || err.message || 'Failed to generate API key');
    } finally {
      setGeneratingApiKey(false);
    }
  };

  const handleRevokeApiKey = async () => {
    setRevokingApiKey(true);
    setApiKeyError(null);
    try {
      const res = await authApi.revokeApiKey();
      if (res.success) {
        setApiKeyData({ hasKey: false });
        setShowApiKey(false);
        setIsRevokeModalOpen(false);
        setApiKeyMessage(res.message || 'API key revoked.');
        setTimeout(() => setApiKeyMessage(null), 5000);
      } else {
        setApiKeyError(res.error || 'Failed to revoke API key');
      }
    } catch (err) {
      setApiKeyError(err.response?.data?.error || err.message || 'Failed to revoke API key');
    } finally {
      setRevokingApiKey(false);
    }
  };

  const handleCopyKey = () => {
    if (!apiKeyData?.apiKey) return;
    navigator.clipboard.writeText(apiKeyData.apiKey);
    setCopiedApiKey(true);
    setTimeout(() => setCopiedApiKey(false), 2500);
  };

  const handleCopyClaudeConfig = () => {
    const configSnippet = JSON.stringify(
      {
        mcpServers: {
          panelhub: {
            url: `${window.location.origin}/api/mcp/sse`,
            headers: {
              Authorization: `Bearer ${apiKeyData?.apiKey || 'YOUR_API_KEY'}`
            }
          }
        }
      },
      null,
      2
    );
    navigator.clipboard.writeText(configSnippet);
    setCopiedClaudeConfig(true);
    setTimeout(() => setCopiedClaudeConfig(false), 2500);
  };

  const handleCopyClaudeWebUrl = () => {
    const connectorUrl = `${window.location.origin}/api/mcp/sse?apiKey=${apiKeyData?.apiKey || ''}`;
    navigator.clipboard.writeText(connectorUrl);
    setCopiedClaudeWebUrl(true);
    setTimeout(() => setCopiedClaudeWebUrl(false), 2500);
  };

  // Delete Account modal state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [showDeletePassword, setShowDeletePassword] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  // Direct password change handler
  const handleChangePassword = async (e) => {
    e.preventDefault();
    setChangePasswordError(null);
    setChangePasswordSuccess(null);

    if (newPassword.length < 6) {
      setChangePasswordError('New password must be at least 6 characters long');
      return;
    }

    if (newPassword !== confirmPassword) {
      setChangePasswordError('New password and confirmation do not match');
      return;
    }

    setChangingPassword(true);
    try {
      const res = await authApi.changePassword(currentPassword, newPassword);
      if (res.success) {
        if (res.token) {
          localStorage.setItem('token', res.token);
        }
        setChangePasswordSuccess(res.message || 'Password updated successfully! All other sessions have been logged out.');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => setChangePasswordSuccess(null), 6000);
      } else {
        setChangePasswordError(res.error || 'Failed to change password');
      }
    } catch (err) {
      setChangePasswordError(err.response?.data?.error || err.message || 'Failed to change password');
    } finally {
      setChangingPassword(false);
    }
  };

  // Dispatch OTP to email for password reset
  const handleSendResetOtp = async () => {
    setSendingOtp(true);
    setOtpError(null);
    setOtpSuccess(null);
    try {
      const res = await authApi.forgotPassword(user.email);
      if (res.success) {
        setOtpSent(true);
        setOtpSuccess('A 6-digit password reset code has been sent to your email address.');
      } else {
        setOtpError(res.error || 'Failed to send reset code');
      }
    } catch (err) {
      setOtpError(err.response?.data?.error || err.message || 'Failed to send reset code');
    } finally {
      setSendingOtp(false);
    }
  };

  // Confirm password reset using OTP
  const handleResetWithOtp = async (e) => {
    e.preventDefault();
    setOtpError(null);
    setOtpSuccess(null);

    if (!otpCode || otpCode.trim().length !== 6) {
      setOtpError('Please enter the 6-digit verification code received in your inbox');
      return;
    }

    if (otpNewPassword.length < 6) {
      setOtpError('New password must be at least 6 characters long');
      return;
    }

    setResettingWithOtp(true);
    try {
      const res = await authApi.resetPassword(user.email, otpCode.trim(), otpNewPassword);
      if (res.success) {
        setOtpSuccess('Password successfully reset! You can now use your new password.');
        setOtpCode('');
        setOtpNewPassword('');
        setTimeout(() => {
          setIsOtpResetMode(false);
          setOtpSent(false);
          setOtpSuccess(null);
        }, 3000);
      } else {
        setOtpError(res.error || 'Failed to reset password');
      }
    } catch (err) {
      setOtpError(err.response?.data?.error || err.message || 'Failed to reset password');
    } finally {
      setResettingWithOtp(false);
    }
  };

  // Delete account handler
  const handleDeleteAccount = async (e) => {
    e.preventDefault();
    setDeleteError(null);

    if (deleteConfirmText.trim().toUpperCase() !== 'DELETE') {
      setDeleteError('Please type DELETE in capital letters to confirm account purge');
      return;
    }

    if (!deletePassword) {
      setDeleteError('Please enter your account password to verify ownership');
      return;
    }

    setDeletingAccount(true);
    try {
      const res = await authApi.deleteAccount(deletePassword);
      if (res.success) {
        alert('Your account and all associated panel credentials have been permanently deleted.');
        logout();
      } else {
        setDeleteError(res.error || 'Failed to delete account');
      }
    } catch (err) {
      setDeleteError(err.response?.data?.error || err.message || 'Failed to delete account');
    } finally {
      setDeletingAccount(false);
    }
  };

  const memberSinceFormatted = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    : 'Active Administrator';

  return (
    <div className="space-y-6 max-w-4xl pb-12">
      {/* Page Title & Breadcrumb */}
      <div>
        <div className="flex items-center gap-2 mb-1.5">
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            Account Management
          </span>
        </div>
        <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Account & Security Preferences</h2>
        <p className="text-xs text-slate-400 mt-1">
          Manage your administrator credentials, email security verification, and account lifecycle.
        </p>
      </div>

      {/* Account Profile Card */}
      <div className="p-4 sm:p-6 rounded-2xl bg-gradient-to-b from-slate-900/90 to-slate-900/50 border border-slate-800 shadow-xl backdrop-blur-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-indigo-500/25 shrink-0">
              {user?.email?.charAt(0).toUpperCase() || 'A'}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-bold text-white truncate">{user?.email}</h3>
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  Verified Admin
                </span>
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                <span>Member since {memberSinceFormatted}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/60 text-xs font-medium text-slate-300">
              <Server className="w-3.5 h-3.5 text-indigo-400" />
              <span>{serverCount} Connected {serverCount === 1 ? 'Panel' : 'Panels'}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/60 text-xs font-medium text-slate-300">
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              <span>AES-256-GCM</span>
            </span>
          </div>
        </div>
      </div>

      {/* Password Management Card */}
      <div className="p-4 sm:p-6 rounded-2xl bg-slate-900/60 border border-slate-800/90 shadow-xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shrink-0">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white">Password & Authentication</h3>
              <p className="text-xs text-slate-400">Update your administrator password or recover access</p>
            </div>
          </div>

          {/* Toggle between Direct Change & OTP Reset */}
          <button
            type="button"
            onClick={() => {
              setIsOtpResetMode((prev) => !prev);
              setChangePasswordError(null);
              setChangePasswordSuccess(null);
              setOtpError(null);
              setOtpSuccess(null);
            }}
            className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 self-start sm:self-center transition-colors"
          >
            {isOtpResetMode ? '← Use Current Password' : 'Forgot current password? Reset via Email OTP →'}
          </button>
        </div>

        {/* MODE A: Direct Password Change */}
        {!isOtpResetMode && (
          <form onSubmit={handleChangePassword} className="space-y-4 max-w-lg">
            {changePasswordSuccess && (
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2.5 animate-fadeIn">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{changePasswordSuccess}</span>
              </div>
            )}

            {changePasswordError && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5 animate-fadeIn">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{changePasswordError}</span>
              </div>
            )}

            {/* Current Password */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Current Password
              </label>
              <div className="relative">
                <input
                  type={showCurrentPassword ? 'text' : 'password'}
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter your current password"
                  className="w-full bg-slate-950/70 border border-slate-800 text-xs text-white rounded-xl px-3.5 py-2.5 pr-10 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-slate-600"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword((prev) => !prev)}
                  className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300"
                  tabIndex={-1}
                >
                  {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                New Password
              </label>
              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="w-full bg-slate-950/70 border border-slate-800 text-xs text-white rounded-xl px-3.5 py-2.5 pr-10 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-slate-600"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword((prev) => !prev)}
                  className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300"
                  tabIndex={-1}
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Must be at least 6 characters long</p>
            </div>

            {/* Confirm New Password */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Confirm New Password
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat new password"
                  className="w-full bg-slate-950/70 border border-slate-800 text-xs text-white rounded-xl px-3.5 py-2.5 pr-10 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-slate-600"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300"
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50"
              >
                {changingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                <span>{changingPassword ? 'Updating Password...' : 'Save New Password'}</span>
              </button>
            </div>
          </form>
        )}

        {/* MODE B: Reset via Email Verification Code */}
        {isOtpResetMode && (
          <div className="space-y-4 max-w-lg animate-fadeIn">
            {otpSuccess && (
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{otpSuccess}</span>
              </div>
            )}

            {otpError && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{otpError}</span>
              </div>
            )}

            {!otpSent ? (
              <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 space-y-3">
                <p className="text-xs text-slate-300 leading-relaxed">
                  We will dispatch a secure 6-digit one-time password (OTP) to your registered email: <strong>{user?.email}</strong>.
                </p>
                <button
                  type="button"
                  onClick={handleSendResetOtp}
                  disabled={sendingOtp}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all disabled:opacity-50 shadow-md shadow-indigo-600/25"
                >
                  {sendingOtp ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  <span>{sendingOtp ? 'Sending Code...' : 'Send 6-Digit Reset Code'}</span>
                </button>
              </div>
            ) : (
              <form onSubmit={handleResetWithOtp} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    6-Digit Verification Code
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    required
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="e.g. 123456"
                    className="w-full font-mono text-center tracking-widest text-lg font-bold bg-slate-950/70 border border-slate-800 text-white rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                  <div className="flex items-center justify-between mt-1 text-[11px] text-slate-500">
                    <span>Valid for 10 minutes</span>
                    <button
                      type="button"
                      onClick={handleSendResetOtp}
                      disabled={sendingOtp}
                      className="text-indigo-400 hover:text-indigo-300 font-medium"
                    >
                      Resend code
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showOtpNewPassword ? 'text' : 'password'}
                      required
                      value={otpNewPassword}
                      onChange={(e) => setOtpNewPassword(e.target.value)}
                      placeholder="Minimum 6 characters"
                      className="w-full bg-slate-950/70 border border-slate-800 text-xs text-white rounded-xl px-3.5 py-2.5 pr-10 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 placeholder:text-slate-600"
                    />
                    <button
                      type="button"
                      onClick={() => setShowOtpNewPassword((prev) => !prev)}
                      className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300"
                      tabIndex={-1}
                    >
                      {showOtpNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={resettingWithOtp || otpCode.length !== 6 || otpNewPassword.length < 6}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50"
                  >
                    {resettingWithOtp ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    <span>{resettingWithOtp ? 'Resetting Password...' : 'Confirm Reset Password'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>

      {/* AI & Model Context Protocol (MCP) Integration Key */}
      <div className="p-4 sm:p-6 rounded-2xl bg-gradient-to-b from-slate-900/80 to-slate-900/40 border border-slate-800 shadow-xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 shrink-0">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-white">AI & Model Context Protocol (MCP) Key</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/10 text-purple-300 border border-purple-500/20">
                  New
                </span>
              </div>
              <p className="text-xs text-slate-400">Authorize Claude, Cursor, ChatGPT, or custom AI agents to manage your 3x-ui panels</p>
            </div>
          </div>
        </div>

        {apiKeyMessage && (
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2.5 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{apiKeyMessage}</span>
          </div>
        )}

        {apiKeyError && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5 animate-fadeIn">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{apiKeyError}</span>
          </div>
        )}

        {loadingApiKey ? (
          <div className="flex items-center justify-center py-8 text-xs text-slate-400 gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
            <span>Loading API key status...</span>
          </div>
        ) : !apiKeyData?.hasKey ? (
          <div className="p-4 sm:p-5 rounded-xl bg-slate-950/60 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-white">No active API key</p>
              <p className="text-[11px] text-slate-400 max-w-lg leading-relaxed">
                Generate an AES-256-GCM encrypted API key to connect your PanelHub account to Claude Desktop, Cursor, or ChatGPT via Model Context Protocol (MCP).
              </p>
            </div>
            <button
              type="button"
              onClick={handleGenerateApiKey}
              disabled={generatingApiKey}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-lg shadow-purple-600/25 transition-all disabled:opacity-50 shrink-0 self-start sm:self-center"
            >
              {generatingApiKey ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              <span>{generatingApiKey ? 'Generating Key...' : 'Generate MCP API Key'}</span>
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Active Key Display */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Your MCP Access Key
                </label>
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Active
                  </span>
                  {apiKeyData?.createdAt && (
                    <span className="text-[11px] text-slate-500">
                      Created {new Date(apiKeyData.createdAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    readOnly
                    value={
                      showApiKey
                        ? apiKeyData.apiKey
                        : `ph_live_${'•'.repeat(48)}${apiKeyData.last4 || ''}`
                    }
                    className="w-full bg-slate-950 border border-slate-800 text-xs font-mono text-slate-200 rounded-xl px-3.5 py-2.5 pr-20 select-all focus:outline-none focus:border-purple-500"
                  />
                  <div className="absolute right-2 top-2 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setShowApiKey((prev) => !prev)}
                      title={showApiKey ? 'Mask Key' : 'Reveal Key'}
                      className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                    >
                      {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={handleCopyKey}
                      title="Copy Key"
                      className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                    >
                      {copiedApiKey ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCopyKey}
                  className="hidden sm:flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-md shadow-purple-600/20 transition-all shrink-0"
                >
                  {copiedApiKey ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedApiKey ? 'Copied!' : 'Copy Key'}</span>
                </button>
              </div>
            </div>

            {/* Quick Metadata & Key Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 text-xs">
              <p className="text-[11px] text-slate-400">
                Last used: <span className="text-slate-300 font-medium">{apiKeyData.lastUsedAt ? new Date(apiKeyData.lastUsedAt).toLocaleString() : 'Never used yet'}</span>
              </p>
              <div className="flex items-center gap-2 self-start sm:self-center">
                <button
                  type="button"
                  onClick={handleGenerateApiKey}
                  disabled={generatingApiKey}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-medium border border-slate-700/60 transition-colors"
                >
                  {generatingApiKey ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  <span>Regenerate</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsRevokeModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-medium border border-rose-500/20 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                  <span>Revoke</span>
                </button>
              </div>
            </div>

            {/* Claude.ai Web Custom Connector Box */}
            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-purple-900/40 text-xs space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-purple-200 font-semibold text-[11px]">
                  <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                  <span>Claude.ai Web Custom Connector</span>
                </div>
                <button
                  type="button"
                  onClick={handleCopyClaudeWebUrl}
                  className="text-[10px] font-semibold text-purple-300 hover:text-white flex items-center gap-1 transition-colors bg-purple-900/30 hover:bg-purple-900/50 px-2 py-0.5 rounded border border-purple-700/40"
                >
                  {copiedClaudeWebUrl ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-purple-400" />}
                  <span>{copiedClaudeWebUrl ? 'Copied Connector URL!' : 'Copy Connector URL'}</span>
                </button>
              </div>

              <div className="space-y-1.5 text-[11px] text-slate-300">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 p-2 rounded-lg bg-slate-900/90 border border-slate-800">
                  <span className="text-slate-400">Step 1 — Name:</span>
                  <code className="text-purple-300 font-mono font-semibold">PanelHub</code>
                </div>
                <div className="flex flex-col gap-1 p-2 rounded-lg bg-slate-900/90 border border-slate-800">
                  <span className="text-slate-400">Step 1 — MCP Server URL:</span>
                  <code className="text-purple-300 font-mono break-all text-[10px]">
                    {`${window.location.origin}/api/mcp/sse?apiKey=${apiKeyData?.apiKey || 'YOUR_API_KEY'}`}
                  </code>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 p-2 rounded-lg bg-slate-900/90 border border-slate-800">
                  <span className="text-slate-400">Step 2 — Authentication:</span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Select "No sign-in"
                  </span>
                </div>
              </div>

              <div className="p-2 rounded-lg bg-amber-500/5 border border-amber-500/20 text-[10px] text-amber-300/90 leading-relaxed">
                💡 <strong>Getting "asked for sign-in (status 404)"?</strong> If you previously disconnected, delete the connector from Claude Settings ➔ Connectors, then click <strong>Add custom connector</strong> and paste the URL above with your API key to bypass Claude's cached error.
              </div>
            </div>

            {/* AI Setup Instructions Box */}
            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/90 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-slate-300 font-semibold text-[11px]">
                  <Terminal className="w-3.5 h-3.5 text-purple-400" />
                  <span>Claude Desktop & Cursor Configuration</span>
                </div>
                <button
                  type="button"
                  onClick={handleCopyClaudeConfig}
                  className="text-[10px] font-semibold text-purple-400 hover:text-purple-300 flex items-center gap-1 transition-colors"
                >
                  {copiedClaudeConfig ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedClaudeConfig ? 'Copied Config!' : 'Copy Config JSON'}</span>
                </button>
              </div>
              <pre className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px] font-mono text-purple-200 overflow-x-auto">
{`{
  "mcpServers": {
    "panelhub": {
      "url": "${window.location.origin}/api/mcp/sse",
      "headers": {
        "Authorization": "Bearer ${apiKeyData?.apiKey || 'YOUR_API_KEY'}"
      }
    }
  }
}`}
              </pre>
            </div>
          </div>
        )}
      </div>

      {/* Automated Digest & Reports Quick Link */}
      <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/40 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20 shrink-0">
            <Mail className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-semibold text-white">Daily Operations & Bandwidth Digest</h4>
            <p className="text-[11px] text-slate-400">Configure automated daily email reports via Brevo API</p>
          </div>
        </div>

        {onOpenDailyReport && (
          <button
            type="button"
            onClick={onOpenDailyReport}
            className="px-3.5 py-1.5 text-xs font-semibold text-sky-300 hover:text-sky-200 bg-sky-950/40 hover:bg-sky-900/50 border border-sky-500/30 rounded-xl transition-all self-start sm:self-center"
          >
            Digest Preferences
          </button>
        )}
      </div>

      {/* DANGER ZONE: Delete Account */}
      <div className="p-4 sm:p-6 rounded-2xl bg-rose-950/15 border border-rose-500/30 shadow-xl space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 shrink-0">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-rose-300">Danger Zone: Permanent Account Deletion</h3>
            <p className="text-xs text-rose-300/70">Irrevocable action: all data associated with this administrator will be purged</p>
          </div>
        </div>

        <div className="text-xs text-slate-300 space-y-2 leading-relaxed bg-slate-950/60 p-3.5 rounded-xl border border-rose-500/20">
          <p className="font-semibold text-rose-300">Before proceeding, please review what happens:</p>
          <ul className="list-disc pl-5 space-y-1 text-slate-400 text-[11px]">
            <li>All encrypted 3x-ui panel access tokens and URLs in your account will be immediately deleted.</li>
            <li>Your remote servers and VPN clients will <strong>continue running untouched</strong> on their respective nodes.</li>
            <li>Your administrator credentials, session tokens, and automated alert preferences will be wiped.</li>
          </ul>
        </div>

        <button
          type="button"
          onClick={() => {
            setIsDeleteModalOpen(true);
            setDeletePassword('');
            setDeleteConfirmText('');
            setDeleteError(null);
          }}
          className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-xl shadow-lg shadow-rose-600/30 transition-all"
        >
          <Trash2 className="w-4 h-4" />
          <span>Delete My Account</span>
        </button>
      </div>

      {/* Delete Account Modal */}
      {isDeleteModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn"
          onClick={() => setIsDeleteModalOpen(false)}
        >
          <div
            className="w-full max-w-md bg-slate-900 border border-rose-500/40 rounded-2xl shadow-2xl overflow-hidden p-5 sm:p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5 text-rose-400">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <h3 className="text-base font-bold text-white">Confirm Account Deletion</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              This action <strong>cannot be undone</strong>. To confirm, please type <strong className="text-rose-400">DELETE</strong> and enter your password.
            </p>

            {deleteError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{deleteError}</span>
              </div>
            )}

            <form onSubmit={handleDeleteAccount} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Type <span className="text-rose-400">DELETE</span> to confirm
                </label>
                <input
                  type="text"
                  required
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="DELETE"
                  className="w-full bg-slate-950/80 border border-slate-700 text-xs text-white rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 uppercase font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Your Account Password
                </label>
                <div className="relative">
                  <input
                    type={showDeletePassword ? 'text' : 'password'}
                    required
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    placeholder="Enter password"
                    className="w-full bg-slate-950/80 border border-slate-700 text-xs text-white rounded-xl px-3.5 py-2.5 pr-10 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowDeletePassword((prev) => !prev)}
                    className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300"
                    tabIndex={-1}
                  >
                    {showDeletePassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={deletingAccount || deleteConfirmText.trim().toUpperCase() !== 'DELETE' || !deletePassword}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-xl shadow-lg shadow-rose-600/30 transition-all disabled:opacity-50"
                >
                  {deletingAccount ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  <span>{deletingAccount ? 'Deleting Account...' : 'Permanently Delete'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Revoke API Key Modal */}
      {isRevokeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <button
                type="button"
                onClick={() => setIsRevokeModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <h3 className="text-base font-bold text-white">Revoke MCP API Key?</h3>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                Are you sure you want to revoke this API key? Any connected AI assistants (Claude, Cursor, ChatGPT) will immediately lose access to your servers.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsRevokeModalOpen(false)}
                className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRevokeApiKey}
                disabled={revokingApiKey}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-xl shadow-lg shadow-rose-600/30 transition-all disabled:opacity-50"
              >
                {revokingApiKey ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                <span>{revokingApiKey ? 'Revoking...' : 'Revoke Key'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
