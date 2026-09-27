import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Server, ShieldCheck, Lock, Mail, ArrowRight, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';

export default function AuthPage() {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const { login, register } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (isRegister && password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      if (isRegister) {
        await register(email, password);
      } else {
        await login(email, password);
      }
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Authentication failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-950 via-slate-950 to-slate-950 text-slate-100">
      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 rounded-3xl overflow-hidden border border-slate-800 bg-slate-900/60 backdrop-blur-xl shadow-2xl">
        {/* Left Side: Brand & Feature Highlights */}
        <div className="p-8 md:p-12 flex flex-col justify-between border-b md:border-b-0 md:border-r border-slate-800/80 bg-gradient-to-br from-indigo-950/40 to-slate-900/40">
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-600/30">
                <Server className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="font-extrabold text-xl tracking-tight text-white">PanelHub</h1>
                <p className="text-xs text-indigo-400 font-medium">Multi-Tenant 3x-ui SaaS Orchestrator</p>
              </div>
            </div>

            <h2 className="text-2xl font-bold tracking-tight text-white mb-3">
              Centralized Control for Distributed 3x-ui Panels
            </h2>
            <p className="text-sm text-slate-400 leading-relaxed mb-6">
              Provider-agnostic administrative dashboard to manage inbounds, monitor bandwidth, and control live clients across all your VPN nodes.
            </p>

            <div className="space-y-3.5">
              {[
                { title: 'AES-256-GCM Encryption', desc: 'Panel passwords encrypted at rest, decrypted only in-memory' },
                { title: 'Live 3x-ui Sync', desc: 'Zero DB storage of inbounds or clients; always live from nodes' },
                { title: 'Strict Multi-Tenancy', desc: 'Complete tenant isolation with ownerId authentication guards' },
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

          <div className="mt-8 pt-6 border-t border-slate-800/80 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Production-grade security</span>
            <span>Rate-limited API</span>
          </div>
        </div>

        {/* Right Side: Form */}
        <div className="p-8 md:p-12 flex flex-col justify-center">
          <div className="mb-6">
            <h3 className="text-xl font-bold text-white">
              {isRegister ? 'Create Admin Account' : 'Welcome Back'}
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              {isRegister
                ? 'Register your SaaS platform administrator credentials'
                : 'Enter your credentials to access your connected panels'}
            </p>
          </div>

          {error && (
            <div className="mb-4 flex items-center gap-2 p-3 text-xs rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
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
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Password
              </label>
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

            {isRegister && (
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
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50 mt-2"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span>{isRegister ? 'Create Platform Account' : 'Sign In to Dashboard'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => {
                setIsRegister(!isRegister);
                setError(null);
              }}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
            >
              {isRegister
                ? 'Already have an account? Sign in instead'
                : "Don't have an account yet? Register now"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
