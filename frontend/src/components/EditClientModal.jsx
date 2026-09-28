import React, { useState } from 'react';
import { X, Check, Calendar, HardDrive, ToggleLeft, ToggleRight, Loader2, AlertCircle } from 'lucide-react';
import { serversApi } from '../api/client';

export default function EditClientModal({ isOpen, onClose, serverId, client, onClientUpdated }) {
  if (!isOpen || !client) return null;

  const [enable, setEnable] = useState(client.enable !== false);
  // Convert client.totalGB (in bytes) to GB for clean user editing
  const [totalGB, setTotalGB] = useState(() => {
    if (!client.totalGB || client.totalGB <= 0) return 0;
    return Math.round((client.totalGB / (1024 * 1024 * 1024)) * 100) / 100;
  });

  // Expiry date representation (yyyy-mm-dd)
  const [expiryDate, setExpiryDate] = useState(() => {
    if (!client.expiryTime || client.expiryTime <= 0) return '';
    const d = new Date(client.expiryTime);
    return d.toISOString().split('T')[0];
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const setDaysFromNow = (days) => {
    if (days === 0) {
      setExpiryDate('');
      return;
    }
    const d = new Date();
    d.setDate(d.getDate() + days);
    setExpiryDate(d.toISOString().split('T')[0]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Calculate bytes from GB
      const quotaInBytes = totalGB > 0 ? Math.round(Number(totalGB) * 1024 * 1024 * 1024) : 0;
      
      // Calculate timestamp in ms
      let expiryTimeMs = 0;
      if (expiryDate) {
        const d = new Date(expiryDate);
        d.setHours(23, 59, 59, 999);
        expiryTimeMs = d.getTime();
      }

      const res = await serversApi.updateClient(serverId, client.id, {
        inboundId: client.inboundId,
        enable,
        totalGB: quotaInBytes,
        expiryTime: expiryTimeMs,
        email: client.email
      });

      if (res.success) {
        onClientUpdated({
          ...client,
          enable,
          totalGB: quotaInBytes,
          expiryTime: expiryTimeMs
        });
        onClose();
      } else {
        setError(res.error || 'Failed to update client');
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to update client');
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
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-800/40">
          <div>
            <h3 className="text-base font-semibold text-white">Edit VPN Client</h3>
            <p className="text-xs text-slate-400 font-mono truncate max-w-xs">{client.email || client.id}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 text-xs rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Enabled Status Toggle */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/80">
            <div>
              <span className="text-xs font-semibold text-slate-200 block">Client Status</span>
              <span className="text-[11px] text-slate-400">
                {enable ? 'Client is active and permitted to connect' : 'Client is deactivated and blocked from connecting'}
              </span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={enable}
              aria-label={enable ? 'Deactivate client' : 'Activate client'}
              onClick={() => setEnable(!enable)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                enable
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-750'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full transition-all ${
                  enable ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-slate-500'
                }`}
              />
              <span>{enable ? 'Active' : 'Disabled'}</span>
              <span
                className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full p-0.5 transition-colors duration-200 ease-in-out ${
                  enable ? 'bg-emerald-600' : 'bg-slate-700'
                }`}
              >
                <span
                  className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform duration-200 ease-in-out shadow-sm ${
                    enable ? 'translate-x-3' : 'translate-x-0'
                  }`}
                />
              </span>
            </button>
          </div>

          {/* Bandwidth Quota */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Bandwidth Quota (Gigabytes)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                <HardDrive className="w-4 h-4" />
              </div>
              <input
                type="number"
                min="0"
                step="0.5"
                placeholder="0 = Unlimited"
                value={totalGB}
                onChange={(e) => setTotalGB(e.target.value)}
                className="w-full pl-9 pr-16 py-2.5 bg-slate-800/80 border border-slate-700/80 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
              <span className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-xs text-slate-500">
                GB
              </span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">Enter 0 for unlimited bandwidth quota</p>
          </div>

          {/* Expiry Date */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Expiration Date
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                <Calendar className="w-4 h-4" />
              </div>
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2.5 bg-slate-800/80 border border-slate-700/80 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            
            {/* Quick date buttons */}
            <div className="flex items-center gap-2 mt-2">
              <button
                type="button"
                onClick={() => setDaysFromNow(30)}
                className="px-2 py-1 text-[11px] rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                +30 Days
              </button>
              <button
                type="button"
                onClick={() => setDaysFromNow(90)}
                className="px-2 py-1 text-[11px] rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                +90 Days
              </button>
              <button
                type="button"
                onClick={() => setDaysFromNow(0)}
                className="px-2 py-1 text-[11px] rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                Never Expire
              </button>
            </div>
          </div>

          {/* Footer */}
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
                  <span>Saving Live...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
