import React, { useState } from 'react';
import { X, UserPlus, Calendar, HardDrive, Loader2, AlertCircle } from 'lucide-react';
import { serversApi } from '../api/client';

export default function AddClientModal({ isOpen, onClose, serverId, inboundId, onClientAdded }) {
  if (!isOpen) return null;

  const [email, setEmail] = useState('');
  const [totalGB, setTotalGB] = useState(25);
  const [expiryDays, setExpiryDays] = useState(30);
  const [enable, setEnable] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Client email / username is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const quotaBytes = totalGB > 0 ? Math.round(Number(totalGB) * 1024 * 1024 * 1024) : 0;
      const expiryMs = expiryDays > 0 ? Date.now() + Number(expiryDays) * 86400000 : 0;

      const res = await serversApi.addClient(serverId, inboundId, {
        email: email.trim(),
        totalGB: quotaBytes,
        expiryTime: expiryMs,
        enable
      });

      if (res.success) {
        onClientAdded(res.client);
        onClose();
      } else {
        setError(res.error || 'Failed to add client');
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to add client to inbound');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-800/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Add VPN Client</h3>
              <p className="text-xs text-slate-400">Created live on 3x-ui panel inbound #{inboundId}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 text-xs rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Client Email / Identifier
            </label>
            <input
              type="text"
              required
              placeholder="e.g. client@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700/80 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Bandwidth Quota (GB)
              </label>
              <input
                type="number"
                min="0"
                step="1"
                placeholder="0 = Unlimited"
                value={totalGB}
                onChange={(e) => setTotalGB(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700/80 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Duration (Days)
              </label>
              <input
                type="number"
                min="0"
                step="1"
                placeholder="0 = Unlimited"
                value={expiryDays}
                onChange={(e) => setExpiryDays(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700/80 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
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
                  <span>Provisioning...</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>Create Client</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
