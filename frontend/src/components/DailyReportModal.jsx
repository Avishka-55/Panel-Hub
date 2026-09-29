import React, { useState, useEffect } from 'react';
import {
  X,
  Mail,
  Send,
  Loader2,
  CheckCircle2,
  Clock,
  Server,
  HardDrive,
  Users,
  Activity,
  Calendar,
  AlertTriangle
} from 'lucide-react';
import { reportsApi } from '../api/client';

export default function DailyReportModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState(null);
  const [enabled, setEnabled] = useState(true);
  const [hourUtc, setHourUtc] = useState(9);
  const [savingPrefs, setSavingPrefs] = useState(false);

  const [sendingNow, setSendingNow] = useState(false);
  const [sendResult, setSendResult] = useState(null);

  const fetchPreview = async () => {
    try {
      setLoading(true);
      const res = await reportsApi.getPreview();
      if (res.success) {
        setPreview(res.reportData);
        if (res.preferences) {
          setEnabled(res.preferences.enabled !== false);
          setHourUtc(res.preferences.hourUtc ?? 9);
        }
      }
    } catch (err) {
      console.error('Failed to load report preview:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchPreview();
      setSendResult(null);
    }
  }, [isOpen]);

  const handleSavePreferences = async (newEnabled, newHour) => {
    setSavingPrefs(true);
    try {
      await reportsApi.updatePreferences({
        enabled: newEnabled !== undefined ? newEnabled : enabled,
        hourUtc: Number(newHour !== undefined ? newHour : hourUtc)
      });
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update preferences');
    } finally {
      setSavingPrefs(false);
    }
  };

  const handleSendNow = async () => {
    setSendingNow(true);
    setSendResult(null);
    try {
      const res = await reportsApi.sendNow();
      setSendResult({
        success: true,
        message: res.message || 'Daily report email sent to your inbox!'
      });
    } catch (err) {
      setSendResult({
        success: false,
        message: err.response?.data?.error || 'Failed to dispatch daily report'
      });
    } finally {
      setSendingNow(false);
    }
  };

  const summary = preview?.summary || {
    totalPanels: 0,
    onlinePanels: 0,
    totalInbounds: 0,
    totalClients: 0,
    totalTraffic: '0 B'
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-1.5 sm:p-4 bg-slate-950/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-3.5 py-2.5 sm:px-6 sm:py-4 border-b border-slate-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <div className="p-1.5 sm:p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shrink-0">
              <Mail className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-xs sm:text-base font-bold text-white truncate">Daily Operations & Health Digest</h3>
              <p className="text-[10px] sm:text-xs text-slate-400 truncate max-w-[200px] xs:max-w-[280px] sm:max-w-md">
                Automated 24h email report for your 3x-ui panels
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors shrink-0"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-3 sm:p-6 space-y-3 sm:space-y-5 overflow-y-auto flex-1">
          {/* Scheduling Configuration Box */}
          <div className="p-2.5 sm:p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4">
            <div className="flex items-start gap-2 sm:gap-3 min-w-0 flex-1">
              <div className={`p-1.5 sm:p-2 rounded-lg shrink-0 ${enabled ? 'bg-indigo-500/10 text-indigo-400' : 'bg-slate-700/40 text-slate-500'}`}>
                <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-semibold text-white">Automated Daily Delivery</p>
                <p className="text-[10px] sm:text-xs text-slate-400 leading-tight">Receive an executive health & bandwidth digest every 24 hours</p>
              </div>
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-2.5 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-700/40">
              <select
                disabled={!enabled || savingPrefs}
                value={hourUtc}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setHourUtc(val);
                  handleSavePreferences(enabled, val);
                }}
                className="flex-1 sm:flex-initial bg-slate-800 border border-slate-700 text-[11px] sm:text-xs text-slate-200 rounded-lg px-2 py-1 sm:px-2.5 sm:py-1.5 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
              >
                {Array.from({ length: 24 }).map((_, i) => (
                  <option key={i} value={i}>
                    {String(i).padStart(2, '0')}:00 UTC
                  </option>
                ))}
              </select>

              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setEnabled(checked);
                    handleSavePreferences(checked, hourUtc);
                  }}
                  className="sr-only peer"
                />
                <div className="w-10 h-5.5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-indigo-600 sm:w-11 sm:h-6 sm:after:h-5 sm:after:w-5"></div>
              </label>
            </div>
          </div>

          {/* Report Live Preview */}
          <div className="space-y-2.5 sm:space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-1">
              <h4 className="text-[10px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Report Preview ({preview?.dateStr || 'Today'})
              </h4>
              {loading && (
                <span className="text-[10px] sm:text-[11px] text-slate-500 flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" /> Fetching live metrics...
                </span>
              )}
            </div>

            {/* Quick Stat Cards - 4-column compact row */}
            <div className="grid grid-cols-4 gap-1.5 sm:gap-2.5">
              <div className="p-1.5 sm:p-3 rounded-lg sm:rounded-xl bg-slate-900 border border-slate-800 text-center">
                <div className="text-[9px] sm:text-[10px] text-slate-400 uppercase font-semibold truncate">Panels</div>
                <div className="text-xs sm:text-lg font-bold text-sky-400 mt-0.5 truncate">{summary.onlinePanels} / {summary.totalPanels}</div>
                <div className="text-[8px] sm:text-[10px] text-emerald-400 truncate">Reachable</div>
              </div>

              <div className="p-1.5 sm:p-3 rounded-lg sm:rounded-xl bg-slate-900 border border-slate-800 text-center">
                <div className="text-[9px] sm:text-[10px] text-slate-400 uppercase font-semibold truncate">Inbounds</div>
                <div className="text-xs sm:text-lg font-bold text-indigo-400 mt-0.5 truncate">{summary.totalInbounds}</div>
                <div className="text-[8px] sm:text-[10px] text-slate-500 truncate">Live ports</div>
              </div>

              <div className="p-1.5 sm:p-3 rounded-lg sm:rounded-xl bg-slate-900 border border-slate-800 text-center">
                <div className="text-[9px] sm:text-[10px] text-slate-400 uppercase font-semibold truncate">Clients</div>
                <div className="text-xs sm:text-lg font-bold text-purple-400 mt-0.5 truncate">{summary.totalClients}</div>
                <div className="text-[8px] sm:text-[10px] text-slate-500 truncate">Active users</div>
              </div>

              <div className="p-1.5 sm:p-3 rounded-lg sm:rounded-xl bg-slate-900 border border-slate-800 text-center">
                <div className="text-[9px] sm:text-[10px] text-slate-400 uppercase font-semibold truncate">Bandwidth</div>
                <div className="text-xs sm:text-base font-bold text-emerald-400 mt-0.5 truncate">{summary.totalTraffic}</div>
                <div className="text-[8px] sm:text-[10px] text-slate-500 truncate">Cumulative</div>
              </div>
            </div>

            {/* Breakdown Table & Mobile Cards */}
            {preview?.serverBreakdown && preview.serverBreakdown.length > 0 && (
              <>
                {/* Desktop 5-column Table */}
                <div className="hidden sm:block border border-slate-800 rounded-xl overflow-hidden bg-slate-900/60">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-800/60 text-[10px] uppercase text-slate-400 font-semibold">
                      <tr>
                        <th className="p-2.5">Node</th>
                        <th className="p-2.5 text-center">Status</th>
                        <th className="p-2.5 text-center">CPU/RAM</th>
                        <th className="p-2.5 text-center">Clients</th>
                        <th className="p-2.5 text-right">Traffic</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80">
                      {preview.serverBreakdown.map((s, idx) => (
                        <tr key={idx} className="hover:bg-slate-800/30">
                          <td className="p-2.5 font-medium text-white">
                            <div className="font-semibold text-white">{s.nickname}</div>
                            <div className="text-[10px] text-slate-500 font-mono">{s.panelUrl}</div>
                          </td>
                          <td className="p-2.5 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${
                              s.status === 'online'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            }`}>
                              {s.status.toUpperCase()}
                            </span>
                          </td>
                          <td className="p-2.5 text-center font-mono text-[11px] text-slate-300">
                            {s.cpu}% / {s.mem}%
                          </td>
                          <td className="p-2.5 text-center text-slate-300">
                            {s.clients}
                          </td>
                          <td className="p-2.5 text-right font-mono text-indigo-300">
                            {s.traffic}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Standalone Cards - Compact */}
                <div className="sm:hidden space-y-2">
                  {preview.serverBreakdown.map((s, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1.5 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-1.5">
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-xs text-white truncate max-w-[190px]">{s.nickname}</div>
                          <div className="text-[9px] text-slate-500 font-mono truncate">{s.panelUrl}</div>
                        </div>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold shrink-0 ${
                          s.status === 'online'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}>
                          {s.status.toUpperCase()}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-1 pt-1.5 border-t border-slate-800/80 text-center">
                        <div className="p-1 rounded-md bg-slate-950/40 border border-slate-800/40">
                          <div className="text-[8px] uppercase font-semibold text-slate-400">CPU / RAM</div>
                          <div className="font-mono text-[10px] text-slate-200 mt-0.5">{s.cpu}% / {s.mem}%</div>
                        </div>
                        <div className="p-1 rounded-md bg-slate-950/40 border border-slate-800/40">
                          <div className="text-[8px] uppercase font-semibold text-slate-400">Clients</div>
                          <div className="font-semibold text-[10px] text-slate-200 mt-0.5">{s.clients}</div>
                        </div>
                        <div className="p-1 rounded-md bg-slate-950/40 border border-slate-800/40">
                          <div className="text-[8px] uppercase font-semibold text-slate-400">Traffic</div>
                          <div className="font-mono font-semibold text-[10px] text-indigo-300 mt-0.5 truncate">{s.traffic}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Feedback banner */}
          {sendResult && (
            <div className={`p-2.5 rounded-lg text-xs flex items-start gap-2 break-words ${sendResult.success ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/10 text-rose-300 border border-rose-500/30'}`}>
              {sendResult.success ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-400 mt-0.5" /> : <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-400 mt-0.5" />}
              <span className="flex-1 leading-snug text-[11px]">{sendResult.message}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-3.5 py-2.5 sm:px-6 sm:py-4 border-t border-slate-800 bg-slate-900/60 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-white transition-colors"
          >
            Close
          </button>

          <button
            type="button"
            onClick={handleSendNow}
            disabled={sendingNow || loading}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 sm:px-5 py-1.5 sm:py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50"
          >
            {sendingNow ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            <span>{sendingNow ? 'Sending Digest...' : 'Send Daily Report Now'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
