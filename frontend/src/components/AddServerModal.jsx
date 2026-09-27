import React, { useState } from 'react';
import { X, Server, ShieldCheck, Key, Globe, User, Sparkles, AlertCircle, Loader2, Lock, Eye, EyeOff } from 'lucide-react';
import { serversApi } from '../api/client';

export default function AddServerModal({ isOpen, onClose, onServerAdded }) {
  const [authType, setAuthType] = useState('api_key'); // 'api_key' | 'credentials'
  const [nickname, setNickname] = useState('');
  const [panelUrl, setPanelUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);

  const [panelUsername, setPanelUsername] = useState('');
  const [panelPassword, setPanelPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleFillMock = () => {
    setNickname('Local 3x-ui Demo Panel');
    setPanelUrl('http://127.0.0.1:2053');
    if (authType === 'api_key') {
      setApiKey('mock-api-key');
    } else {
      setPanelUsername('admin');
      setPanelPassword('password123');
    }
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!nickname.trim() || !panelUrl.trim()) {
      setError('Nickname and Panel URL are required.');
      return;
    }

    if (authType === 'api_key' && !apiKey.trim()) {
      setError('3x-ui API Key is required.');
      return;
    }

    if (authType === 'credentials' && (!panelUsername.trim() || !panelPassword)) {
      setError('Username and password are required.');
      return;
    }

    setLoading(true);

    try {
      const payload = {
        nickname: nickname.trim(),
        panelUrl: panelUrl.trim(),
        authType
      };

      if (authType === 'api_key') {
        payload.apiKey = apiKey.trim();
      } else {
        payload.panelUsername = panelUsername.trim();
        payload.panelPassword = panelPassword;
      }

      const res = await serversApi.add(payload);

      if (res.success) {
        onServerAdded(res.server);
        onClose();
      } else {
        setError(res.error || 'Failed to add server');
      }
    } catch (err) {
      const message = err.response?.data?.error || err.message || 'Failed to add server';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-800/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Connect 3x-ui Panel</h3>
              <p className="text-xs text-slate-400">Encrypted with AES-256-GCM • Never returned or exposed</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Quick Mock Preset Button */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-indigo-950/30 border border-indigo-500/20 text-xs">
            <div className="flex items-center gap-2 text-indigo-300">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span>Testing locally? Fill with dev mock panel</span>
            </div>
            <button
              type="button"
              onClick={handleFillMock}
              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
            >
              Autofill Mock
            </button>
          </div>

          {/* Auth Method Selector */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Authentication Method
            </label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950/60 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => setAuthType('api_key')}
                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                  authType === 'api_key'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Key className="w-3.5 h-3.5" />
                <span>3x-ui API Token</span>
              </button>

              <button
                type="button"
                onClick={() => setAuthType('credentials')}
                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                  authType === 'credentials'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Username & Password</span>
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 text-xs rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Server Nickname
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Azure Singapore Gateway"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700/80 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Panel URL (Domain or IP + Port)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                <Globe className="w-4 h-4" />
              </div>
              <input
                type="text"
                required
                placeholder="https://52.237.119.11:45214/SFF3xGhBKgeMn7fl4X or http://ip:2053"
                value={panelUrl}
                onChange={(e) => setPanelUrl(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2.5 bg-slate-800/80 border border-slate-700/80 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
              />
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              Include scheme (http:// or https://) and any custom base path. Self-signed SSL is supported.
            </p>
          </div>

          {authType === 'api_key' ? (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-slate-300">
                  3x-ui API Token
                </label>
                <span className="text-[10px] text-indigo-400 font-mono">Bearer Auth</span>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Key className="w-4 h-4" />
                </div>
                <input
                  type={showApiKey ? 'text' : 'password'}
                  required
                  placeholder="Paste your 3x-ui API token..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="w-full pl-9 pr-10 py-2.5 bg-slate-800/80 border border-slate-700/80 rounded-xl text-sm text-white placeholder-slate-500 font-mono focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white"
                >
                  {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="mt-1 text-[11px] text-slate-500">
                Found in your 3x-ui panel under <strong>Settings → Security → API Tokens</strong>.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Panel Username
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="admin"
                    value={panelUsername}
                    onChange={(e) => setPanelUsername(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2.5 bg-slate-800/80 border border-slate-700/80 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Panel Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="••••••••"
                    value={panelPassword}
                    onChange={(e) => setPanelPassword(e.target.value)}
                    className="w-full pl-9 pr-10 py-2.5 bg-slate-800/80 border border-slate-700/80 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Connecting...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Encrypt & Add Panel</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
