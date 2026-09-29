import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../api/client';
import {
  Server,
  ShieldCheck,
  Lock,
  Mail,
  ArrowRight,
  CheckCircle2,
  Loader2,
  AlertCircle,
  KeyRound,
  ArrowLeft,
  RotateCcw
} from 'lucide-react';

export default function AuthPage() {
  // Modes: 'login' | 'register' | 'verify_otp' | 'forgot_password' | 'reset_password_otp'
  const [mode, setMode] = useState('login');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Resend OTP cooldown timer
  const [resendCooldown, setResendCooldown] = useState(0);

  const { login, register, verifyOtp } = useAuth();

  useEffect(() => {
    let timer;
    if (resendCooldown > 0) {
      timer = setInterval(() => {
        setResendCooldown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const switchMode = (newMode) => {
    setMode(newMode);
    setError(null);
    setSuccessMessage(null);
    setOtp('');
  };

  // Submit handler for Registration
  const handleRegister = async (e) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      const res = await register(email, password);
      if (res.requiresVerification) {
        setSuccessMessage('A 6-digit verification code has been sent to your email.');
        setMode('verify_otp');
        setResendCooldown(60);
      } else if (res.token) {
        // Direct login if already verified
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  // Submit handler for Login
  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);

    setLoading(true);
    try {
      const res = await login(email, password);
      if (res.requiresVerification) {
        setError(res.error || 'Your email is not verified yet. We sent you a new verification code.');
        setMode('verify_otp');
        setResendCooldown(60);
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  // Submit handler for Email Verification OTP
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError(null);

    if (!otp || otp.trim().length !== 6) {
      setError('Please enter the complete 6-digit security code');
      return;
    }

    setLoading(true);
    try {
      await verifyOtp(email, otp.trim());
      // On success, AuthContext automatically stores token and logs in
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Invalid or expired verification code');
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP handler
  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    setError(null);
    setLoading(true);
    try {
      const res = await authApi.resendOtp(email);
      setSuccessMessage(res.message || 'A fresh verification code has been sent to your inbox.');
      setResendCooldown(60);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to resend code');
    } finally {
      setLoading(false);
    }
  };

  // Request Password Reset OTP handler
  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setError(null);

    if (!email) {
      setError('Please provide your admin email address');
      return;
    }

    setLoading(true);
    try {
      const res = await authApi.forgotPassword(email);
      setSuccessMessage(res.message || 'A 6-digit reset code has been sent to your email.');
      setMode('reset_password_otp');
      setResendCooldown(60);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to process request');
    } finally {
      setLoading(false);
    }
  };

  // Submit New Password with Reset OTP
  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError(null);

    if (!otp || otp.trim().length !== 6) {
      setError('Please enter the 6-digit security code');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setError('Passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters long');
      return;
    }

    setLoading(true);
    try {
      const res = await authApi.resetPassword(email, otp.trim(), newPassword);
      setSuccessMessage(res.message || 'Password reset successfully! Please sign in with your new password.');
      setMode('login');
      setPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-950 via-slate-950 to-slate-950 text-slate-100">
      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 rounded-3xl overflow-hidden border border-slate-800 bg-slate-900/60 backdrop-blur-xl shadow-2xl">
        {/* Left Side: Brand & Feature Highlights */}
        <div className="p-6 md:p-12 flex flex-col justify-between border-b md:border-b-0 md:border-r border-slate-800/80 bg-gradient-to-br from-indigo-950/40 to-slate-900/40">
          <div>
            <div className="flex items-center gap-3 mb-4 md:mb-6">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-600/30">
                <Server className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="font-extrabold text-xl tracking-tight text-white">PanelHub</h1>
                <p className="text-xs text-indigo-400 font-medium">Multi-Tenant 3x-ui SaaS Orchestrator</p>
              </div>
            </div>

            <h2 className="text-lg md:text-2xl font-bold tracking-tight text-white mb-2 md:mb-3">
              Centralized Control for Distributed 3x-ui Panels
            </h2>
            <p className="text-xs md:text-sm text-slate-400 leading-relaxed mb-0 md:mb-6">
              Provider-agnostic administrative dashboard to manage inbounds, monitor bandwidth, and control live clients across all your VPN nodes.
            </p>

            {/* Feature Highlights: Hidden on mobile, visible on tablet/desktop */}
            <div className="hidden md:block space-y-3.5">
              {[
                { title: 'AES-256-GCM Encryption', desc: 'Panel passwords encrypted at rest, decrypted only in-memory' },
                { title: 'OTP Email Security', desc: 'Two-step verification & secure password recovery via Brevo' },
                { title: 'Live 3x-ui Sync', desc: 'Zero DB storage of inbounds or clients; always live from nodes' },
                { title: 'Universal Protocol Support', desc: 'Manage VLESS, VMess, Trojan, and Shadowsocks clients' }
              ].map((feat, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="p-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mt-0.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-slate-200">{feat.title}</h4>
                    <p className="text-[11px] text-slate-400">{feat.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="hidden md:flex mt-8 pt-6 border-t border-slate-800/80 text-[11px] text-slate-500 items-center justify-between">
            <span>Production-grade security</span>
            <span>Rate-limited API</span>
          </div>
        </div>

        {/* Right Side: Dynamic Form depending on mode */}
        <div className="p-6 md:p-12 flex flex-col justify-center">
          {/* Notification Messages */}
          {error && (
            <div className="mb-4 flex items-center gap-2 p-3 text-xs rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 animate-fadeIn">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMessage && (
            <div className="mb-4 flex items-center gap-2 p-3 text-xs rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* MODE 1: LOGIN */}
          {mode === 'login' && (
            <>
              <div className="mb-6">
                <h3 className="text-xl font-bold text-white">Welcome Back</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Enter your credentials to access your connected panels
                </p>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Admin Email Address
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      type="email"
                      required
                      placeholder="admin@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-800/60 border border-slate-700/80 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-medium text-slate-300">Password</label>
                    <button
                      type="button"
                      onClick={() => switchMode('forgot_password')}
                      className="text-[11px] text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-800/60 border border-slate-700/80 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50 mt-2"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span>Sign In to Dashboard</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              <div className="mt-6 text-center">
                <button
                  type="button"
                  onClick={() => switchMode('register')}
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
                >
                  Don't have an account yet? Register now
                </button>
              </div>
            </>
          )}

          {/* MODE 2: REGISTER */}
          {mode === 'register' && (
            <>
              <div className="mb-6">
                <h3 className="text-xl font-bold text-white">Create Admin Account</h3>
                <p className="text-xs text-slate-400 mt-1">
                  We'll send a 6-digit verification code to confirm ownership
                </p>
              </div>

              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Admin Email Address
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      type="email"
                      required
                      placeholder="admin@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-800/60 border border-slate-700/80 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">Password</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-800/60 border border-slate-700/80 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-800/60 border border-slate-700/80 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50 mt-2"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span>Continue & Send Security Code</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              <div className="mt-6 text-center">
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
                >
                  Already have an account? Sign in instead
                </button>
              </div>
            </>
          )}

          {/* MODE 3: VERIFY REGISTRATION OTP */}
          {mode === 'verify_otp' && (
            <>
              <div className="mb-6">
                <div className="inline-flex p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 mb-3">
                  <KeyRound className="w-5 h-5" />
                </div>
                <h3 className="text-xl font-bold text-white">Enter Security Code</h3>
                <p className="text-xs text-slate-400 mt-1">
                  We sent a 6-digit verification code to <strong className="text-white">{email}</strong>
                </p>
              </div>

              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    6-Digit Security Code
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    autoFocus
                    placeholder="123456"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    className="w-full text-center tracking-[0.5em] text-xl font-mono font-bold py-3 bg-slate-800/80 border border-indigo-500/40 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                  />
                  <p className="text-[11px] text-slate-500 mt-1.5 text-center">
                    Check your spam or junk folder if you don't see it within 30 seconds.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading || otp.length !== 6}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30 transition-all disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span>Verify & Enter Dashboard</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              <div className="mt-5 flex items-center justify-between text-xs pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => switchMode('register')}
                  className="flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Change Email</span>
                </button>

                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={resendCooldown > 0 || loading}
                  className="flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300 disabled:text-slate-600 transition-colors font-medium"
                >
                  <RotateCcw className={`w-3.5 h-3.5 ${resendCooldown > 0 ? '' : 'hover:rotate-180 transition-transform'}`} />
                  <span>
                    {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend Code'}
                  </span>
                </button>
              </div>
            </>
          )}

          {/* MODE 4: FORGOT PASSWORD REQUEST */}
          {mode === 'forgot_password' && (
            <>
              <div className="mb-6">
                <div className="inline-flex p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 mb-3">
                  <KeyRound className="w-5 h-5" />
                </div>
                <h3 className="text-xl font-bold text-white">Reset Account Password</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Enter your admin email. We will dispatch a 6-digit recovery code.
                </p>
              </div>

              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Account Email Address
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      type="email"
                      required
                      placeholder="admin@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-800/60 border border-slate-700/80 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-600/30 transition-all disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span>Send Password Reset Code</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              <div className="mt-6 text-center">
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Remember your password? Sign in</span>
                </button>
              </div>
            </>
          )}

          {/* MODE 5: RESET PASSWORD WITH OTP */}
          {mode === 'reset_password_otp' && (
            <>
              <div className="mb-6">
                <div className="inline-flex p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 mb-3">
                  <Lock className="w-5 h-5" />
                </div>
                <h3 className="text-xl font-bold text-white">Create New Password</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Enter the 6-digit code sent to <strong className="text-white">{email}</strong> and pick a new password
                </p>
              </div>

              <form onSubmit={handleResetPassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    6-Digit Security Code
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    autoFocus
                    placeholder="123456"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    className="w-full text-center tracking-[0.5em] text-xl font-mono font-bold py-2.5 bg-slate-800/80 border border-amber-500/40 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    New Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-800/60 border border-slate-700/80 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-800/60 border border-slate-700/80 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || otp.length !== 6}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-600/30 transition-all disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span>Reset Password & Sign In</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              <div className="mt-5 flex items-center justify-between text-xs pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className="flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Sign In</span>
                </button>

                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={resendCooldown > 0 || loading}
                  className="text-amber-400 hover:text-amber-300 disabled:text-slate-600 transition-colors font-medium"
                >
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
