import React, { useState, useEffect } from 'react';
import {
  X,
  Bell,
  BellOff,
  ShieldAlert,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Send,
  Loader2,
  Sliders,
  Cpu,
  Layers
} from 'lucide-react';
import { serversApi } from '../api/client';

export default function AlertSettingsModal({ isOpen, onClose, server, onSaved }) {
  if (!isOpen || !server) return null;

  const currentMonitoring = server.monitoring || {};

  const [enabled, setEnabled] = useState(currentMonitoring.enabled !== false);
  const [emailAlerts, setEmailAlerts] = useState(currentMonitoring.emailAlerts !== false);
  const [notifyOnDown, setNotifyOnDown] = useState(currentMonitoring.notifyOnDown !== false);
  const [notifyOnRecover, setNotifyOnRecover] = useState(currentMonitoring.notifyOnRecover !== false);
  const [notifyOnHighResource, setNotifyOnHighResource] = useState(currentMonitoring.notifyOnHighResource === true);
  const [cpuThreshold, setCpuThreshold] = useState(currentMonitoring.cpuThreshold || 90);
  const [ramThreshold, setRamThreshold] = useState(currentMonitoring.ramThreshold || 90);
  const [consecutiveFails, setConsecutiveFails] = useState(currentMonitoring.consecutiveFails || 1);

  const [saving, setSaving] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Initialize form state ONLY when opened or when server ID changes
  useEffect(() => {
    if (isOpen && server) {
      const m = server.monitoring || {};
      setEnabled(m.enabled !== false);
      setEmailAlerts(m.emailAlerts !== false);
      setNotifyOnDown(m.notifyOnDown !== false);
      setNotifyOnRecover(m.notifyOnRecover !== false);
      setNotifyOnHighResource(m.notifyOnHighResource === true);
      setCpuThreshold(m.cpuThreshold || 90);
      setRamThreshold(m.ramThreshold || 90);
      setConsecutiveFails(m.consecutiveFails || 1);
      setTestResult(null);
      setSaveSuccess(false);
    }
  }, [isOpen, server?._id]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setTestResult(null);

    try {
      const payload = {
        enabled,
        emailAlerts,
        notifyOnDown,
        notifyOnRecover,
        notifyOnHighResource,
        cpuThreshold: Number(cpuThreshold),
        ramThreshold: Number(ramThreshold),
        consecutiveFails: Number(consecutiveFails)
      };

      const res = await serversApi.updateMonitoring(server._id, payload);
      if (res.success) {
        setSaveSuccess(true);
        if (onSaved) {
          onSaved({ ...server, monitoring: res.monitoring });
        }
        setTimeout(() => {
          onClose();
        }, 800);
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to save alert settings');
    } finally {
      setSaving(false);
    }
  };

  const handleSendTestAlert = async () => {
    setSendingTest(true);
    setTestResult(null);
    try {
      const res = await serversApi.sendTestAlert(server._id);
      setTestResult({
        success: true,
        message: res.message || 'Sample test alert sent to your email!'
      });
    } catch (err) {
      setTestResult({
        success: false,
        message: err.response?.data?.error || 'Failed to send test alert'
      });
    } finally {
      setSendingTest(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Alert & Monitoring Customization</h3>
              <p className="text-xs text-slate-400 truncate max-w-xs">{server.nickname} ({server.panelUrl})</p>
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
        <form onSubmit={handleSave} className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Master Email Alerts Toggle */}
          <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 flex items-center justify-between">
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-lg ${emailAlerts ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-700/40 text-slate-500'}`}>
                {emailAlerts ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Brevo Email Notifications</p>
                <p className="text-xs text-slate-400">Master switch for all email alerts on this node</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={emailAlerts}
                onChange={(e) => setEmailAlerts(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-transform after:duration-200 peer-checked:bg-indigo-600"></div>
            </label>
          </div>

          {/* Granular Alert Types */}
          <div className={`space-y-3 transition-opacity ${emailAlerts ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-1">Alert Triggers</h4>

            {/* 1. Server Downtime Alert */}
            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                <div>
                  <p className="text-xs font-semibold text-slate-200">Server Offline / Unreachable Alert</p>
                  <p className="text-[11px] text-slate-400">Notify immediately when panel stops responding</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={notifyOnDown}
                onChange={(e) => setNotifyOnDown(e.target.checked)}
                className="w-4 h-4 rounded bg-slate-800 border-slate-700 text-indigo-600 focus:ring-indigo-500"
              />
            </div>

            {/* Sensitivity */}
            {notifyOnDown && (
              <div className="ml-4 pl-3 border-l-2 border-slate-800 flex items-center justify-between py-1">
                <span className="text-xs text-slate-400">Failure Sensitivity:</span>
                <select
                  value={consecutiveFails}
                  onChange={(e) => setConsecutiveFails(Number(e.target.value))}
                  className="bg-slate-800 border border-slate-700 text-xs text-slate-200 rounded-lg px-2.5 py-1 focus:outline-none focus:border-indigo-500"
                >
                  <option value={1}>Immediate (1st failure)</option>
                  <option value={2}>Tolerant (2 consecutive failures)</option>
                  <option value={3}>Conservative (3 consecutive failures)</option>
                </select>
              </div>
            )}

            {/* 2. Server Recovery Alert */}
            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <div>
                  <p className="text-xs font-semibold text-slate-200">Server Recovery Alert</p>
                  <p className="text-[11px] text-slate-400">Notify when the node returns online with downtime duration</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={notifyOnRecover}
                onChange={(e) => setNotifyOnRecover(e.target.checked)}
                className="w-4 h-4 rounded bg-slate-800 border-slate-700 text-indigo-600 focus:ring-indigo-500"
              />
            </div>

            {/* 3. High Resource Utilization Alert */}
            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  <div>
                    <p className="text-xs font-semibold text-slate-200">High Resource Alert (Optional)</p>
                    <p className="text-[11px] text-slate-400">Trigger warnings if CPU or Memory stays overloaded</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={notifyOnHighResource}
                  onChange={(e) => setNotifyOnHighResource(e.target.checked)}
                  className="w-4 h-4 rounded bg-slate-800 border-slate-700 text-indigo-600 focus:ring-indigo-500"
                />
              </div>

              {notifyOnHighResource && (
                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800/80">
                  <div>
                    <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                      <span className="flex items-center gap-1"><Cpu className="w-3 h-3 text-amber-400" /> CPU Threshold</span>
                      <strong className="text-white font-mono">{cpuThreshold}%</strong>
                    </div>
                    <input
                      type="range"
                      min="50"
                      max="99"
                      value={cpuThreshold}
                      onChange={(e) => setCpuThreshold(Number(e.target.value))}
                      className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                      <span className="flex items-center gap-1"><Layers className="w-3 h-3 text-amber-400" /> RAM Threshold</span>
                      <strong className="text-white font-mono">{ramThreshold}%</strong>
                    </div>
                    <input
                      type="range"
                      min="50"
                      max="99"
                      value={ramThreshold}
                      onChange={(e) => setRamThreshold(Number(e.target.value))}
                      className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Test Alert Dispatch */}
          <div className="p-3 rounded-xl bg-indigo-950/20 border border-indigo-500/20 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-indigo-300">Test Brevo Email Delivery</p>
              <p className="text-[11px] text-slate-400">Send an immediate mock alert to test your inbox</p>
            </div>
            <button
              type="button"
              onClick={handleSendTestAlert}
              disabled={sendingTest}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-200 bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/40 rounded-lg transition-all shrink-0"
            >
              {sendingTest ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              <span>{sendingTest ? 'Sending...' : 'Send Test Alert'}</span>
            </button>
          </div>

          {testResult && (
            <div className={`p-3 rounded-xl text-xs flex items-center gap-2 ${testResult.success ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/10 text-rose-300 border border-rose-500/30'}`}>
              {testResult.success ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
              <span>{testResult.message}</span>
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/60 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white transition-colors"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
            <span>{saveSuccess ? 'Saved!' : 'Save Preferences'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
