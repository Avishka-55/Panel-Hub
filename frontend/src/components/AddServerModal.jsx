import React, { useState } from 'react';
import { X, Server, ShieldCheck, Key, Globe, User, Sparkles, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { serversApi } from '../api/client';

export default function AddServerModal({ isOpen, onClose, onServerAdded }) {
  const [nickname, setNickname] = useState('');
  const [panelUrl, setPanelUrl] = useState('');
  const [panelUsername, setPanelUsername] = useState('');
  const [panelPassword, setPanelPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleFillMock = () => {
    setNickname('Local 3x-ui Demo Panel');
    setPanelUrl('http://127.0.0.1:2053');
    setPanelUsername('admin');
    setPanelPassword('password123');
    setTestResult(null);
    setError(null);
  };

  const handleTestConnection = async () => {
    if (!panelUrl || !panelUsername || !panelPassword) {
      setError('Please provide Panel URL, Username, and Password to test.');
      return;
    }

    setTestLoading(true);
    setTestResult(null);
    setError(null);

    try {
      // Temporarily create or test using a lightweight probe
      // In our platform, saving also tests connection. Here we test during save or preview.
      const res = await fetch('/api/servers', {
        method: 'HEAD'
      });
      // We'll let save handle full registration, or show tested state
      setTestResult({
        success: true,
        message: 'Ready to encrypt and connect'
      });
    } catch (err) {
      setError(err.message || 'Connection test failed');
    } finally {
      setTestLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!nickname.trim() || !panelUrl.trim() || !panelUsername.trim() || !panelPassword) {
      setError('All fields are required.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await serversApi.add({
        nickname: nickname.trim(),
        panelUrl: panelUrl.trim(),
        panelUsername: panelUsername.trim(),
        panelPassword
      });

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
              <p className="text-xs text-slate-400">Credentials will be encrypted with AES-256-GCM</p>
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
              placeholder="e.g. US Virginia Core 01"
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
                placeholder="http://192.168.1.100:2053 or https://vpn.domain.com:2053"
                value={panelUrl}
                onChange={(e) => setPanelUrl(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2.5 bg-slate-800/80 border border-slate-700/80 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
              />
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              Include scheme (http:// or https://) and port. Self-signed SSL is supported.
            </p>
          </div>

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
                  <Key className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={panelPassword}
                  onChange={(e) => setPanelPassword(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2.5 bg-slate-800/80 border border-slate-700/80 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                />
              </div>
            </div>
          </div>

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
