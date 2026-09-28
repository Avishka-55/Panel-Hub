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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Daily Operations & Health Digest</h3>
              <p className="text-xs text-slate-400">Scheduled automated email report for all your 3x-ui panels</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Scheduling Configuration Box */}
          <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-lg ${enabled ? 'bg-indigo-500/10 text-indigo-400' : 'bg-slate-700/40 text-slate-500'}`}>
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Automated Daily Delivery</p>
                <p className="text-xs text-slate-400">Receive an executive health & bandwidth digest every 24 hours</p>
              </div>
            </div>

            <div className="flex items-center gap-3 self-end sm:self-center">
              <select
                disabled={!enabled || savingPrefs}
                value={hourUtc}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setHourUtc(val);
                  handleSavePreferences(enabled, val);
                }}
                className="bg-slate-800 border border-slate-700 text-xs text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
              >
                {Array.from({ length: 24 }).map((_, i) => (
                  <option key={i} value={i}>
                    {String(i).padStart(2, '0')}:00 UTC
                  </option>
                ))}
              </select>

              <label className="relative inline-flex items-center cursor-pointer">
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
                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>
          </div>

          {/* Report Live Preview */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Report Preview ({preview?.dateStr || 'Today'})</h4>
              {loading && <span className="text-[11px] text-slate-500 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Fetching live metrics...</span>}
            </div>

            {/* Quick Stat Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-center">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Panels</div>
                <div className="text-lg font-bold text-sky-400 mt-0.5">{summary.onlinePanels} / {summary.totalPanels}</div>
                <div className="text-[10px] text-emerald-400">Reachable</div>
              </div>

              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-center">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Inbounds</div>
                <div className="text-lg font-bold text-indigo-400 mt-0.5">{summary.totalInbounds}</div>
                <div className="text-[10px] text-slate-500">Live ports</div>
              </div>

              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-center">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Clients</div>
                <div className="text-lg font-bold text-purple-400 mt-0.5">{summary.totalClients}</div>
                <div className="text-[10px] text-slate-500">Active users</div>
              </div>

              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-center">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Bandwidth</div>
                <div className="text-base font-bold text-emerald-400 mt-0.5 truncate">{summary.totalTraffic}</div>
                <div className="text-[10px] text-slate-500">Cumulative</div>
              </div>
            </div>

            {/* Breakdown Table */}
            {preview?.serverBreakdown && preview.serverBreakdown.length > 0 && (
              <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/60">
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
                          {s.nickname}
                          <div className="text-[10px] text-slate-500 font-mono">{s.panelUrl}</div>
                        </td>
                        <td className="p-2.5 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${s.status === 'online' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
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
            )}
          </div>

          {/* Feedback banner */}
          {sendResult && (
            <div className={`p-3 rounded-xl text-xs flex items-center gap-2 ${sendResult.success ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/10 text-rose-300 border border-rose-500/30'}`}>
              {sendResult.success ? <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />}
              <span>{sendResult.message}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/60 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white transition-colors"
          >
            Close
          </button>

          <button
            type="button"
            onClick={handleSendNow}
            disabled={sendingNow || loading}
            className="flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50"
          >
            {sendingNow ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            <span>{sendingNow ? 'Sending Digest...' : 'Send Daily Report Now'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
