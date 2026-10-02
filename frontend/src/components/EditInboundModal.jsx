import React, { useState } from 'react';
import { X, Check, Calendar, HardDrive, ToggleLeft, ToggleRight, Loader2, AlertCircle, RotateCcw } from 'lucide-react';
import { serversApi } from '../api/client';

export default function EditInboundModal({ isOpen, onClose, serverId, inbound, onInboundUpdated }) {
  if (!isOpen || !inbound) return null;

  const [remark, setRemark] = useState(inbound.remark || '');
  const [enable, setEnable] = useState(inbound.enable !== false);

  // Convert inbound.total (in bytes) to GB
  const [totalGB, setTotalGB] = useState(() => {
    if (!inbound.total || inbound.total <= 0) return 0;
    return Math.round((inbound.total / (1024 * 1024 * 1024)) * 100) / 100;
  });

  // Expiry date representation (yyyy-mm-dd)
  const [expiryDate, setExpiryDate] = useState(() => {
    if (!inbound.expiryTime || inbound.expiryTime <= 0) return '';
    const d = new Date(inbound.expiryTime);
    return d.toISOString().split('T')[0];
  });

  const [resetTraffic, setResetTraffic] = useState(false);
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
      const quotaInBytes = totalGB > 0 ? Math.round(Number(totalGB) * 1024 * 1024 * 1024) : 0;

      let expiryTimeMs = 0;
      if (expiryDate) {
        const d = new Date(expiryDate);
        d.setHours(23, 59, 59, 999);
        expiryTimeMs = d.getTime();
      }

      const res = await serversApi.updateInbound(serverId, inbound.id, {
        remark,
        enable,
        totalGB: Number(totalGB),
        expiryTime: expiryTimeMs,
        resetTraffic
      });

      if (res.success) {
        onInboundUpdated({
          ...inbound,
          remark,
          enable,
          total: quotaInBytes,
          expiryTime: expiryTimeMs,
          up: resetTraffic ? 0 : inbound.up,
          down: resetTraffic ? 0 : inbound.down
        });
        onClose();
      } else {
        setError(res.error || 'Failed to update inbound');
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to update inbound');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-800/40">
          <div>
            <h3 className="text-base font-semibold text-white">Configure Inbound Quota & Limits</h3>
            <p className="text-xs text-slate-400 font-mono truncate max-w-xs">
              #{inbound.id} • {inbound.protocol?.toUpperCase()} :{inbound.port}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1">{error}</div>
            </div>
          )}

          {/* Inbound Name / Remark */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Inbound Label / Remark
            </label>
            <input
              type="text"
              required
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              placeholder="e.g. US-East-VLESS-CDN"
              className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Monthly / Total Bandwidth Limit (GB) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5 text-indigo-400" />
                <span>Monthly / Total Data Limit (GB)</span>
              </label>
              <span className="text-[11px] text-slate-500">0 = Unlimited</span>
            </div>
            <div className="relative">
              <input
                type="number"
                min="0"
                step="any"
                value={totalGB}
                onChange={(e) => setTotalGB(e.target.value)}
                placeholder="0 for unlimited"
                className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 pr-12 font-mono"
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">
                GB
              </span>
            </div>

            {/* Quick GB presets */}
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              {[
                { label: 'Unlimited', val: 0 },
                { label: '100 GB', val: 100 },
                { label: '500 GB', val: 500 },
                { label: '1 TB', val: 1024 },
                { label: '2 TB', val: 2048 }
              ].map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => setTotalGB(p.val)}
                  className={`px-2.5 py-1 text-[11px] rounded-lg border transition-all ${
                    Number(totalGB) === p.val
                      ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/40 font-semibold'
                      : 'bg-slate-800/60 text-slate-400 border-slate-700/60 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Expiration Date / Validity */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                <span>Expiration Date</span>
              </label>
              <span className="text-[11px] text-slate-500">Optional</span>
            </div>
            <input
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />

            {/* Quick Day Presets */}
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              {[
                { label: 'No Expiry', days: 0 },
                { label: '30 Days (1 Mo)', days: 30 },
                { label: '60 Days (2 Mo)', days: 60 },
                { label: '90 Days (3 Mo)', days: 90 }
              ].map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => setDaysFromNow(p.days)}
                  className="px-2.5 py-1 text-[11px] rounded-lg bg-slate-800/60 text-slate-400 border border-slate-700/60 hover:bg-slate-800 hover:text-slate-200 transition-colors"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Enable / Disable Listener Toggle */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800">
            <div>
              <span className="text-xs font-medium text-slate-200 block">Inbound Listener Status</span>
              <span className="text-[11px] text-slate-500 block">
                {enable ? 'Accepting proxy connections on port :' + inbound.port : 'Inbound disabled on panel'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setEnable(!enable)}
              className="focus:outline-none text-slate-400 hover:text-white transition-colors"
            >
              {enable ? (
                <ToggleRight className="w-8 h-8 text-emerald-400" />
              ) : (
                <ToggleLeft className="w-8 h-8 text-slate-600" />
              )}
            </button>
          </div>

          {/* Reset Monthly Traffic Option */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800">
            <div>
              <span className="text-xs font-medium text-slate-200 block flex items-center gap-1.5">
                <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                <span>Reset Traffic Counters to 0</span>
              </span>
              <span className="text-[11px] text-slate-500 block">
                Start a fresh monthly billing cycle for this inbound
              </span>
            </div>
            <input
              type="checkbox"
              id="resetTrafficCheck"
              checked={resetTraffic}
              onChange={(e) => setResetTraffic(e.target.checked)}
              className="w-4 h-4 rounded text-indigo-600 bg-slate-900 border-slate-700 focus:ring-indigo-500 cursor-pointer"
            />
          </div>

          {/* Footer Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Save Inbound Settings</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
