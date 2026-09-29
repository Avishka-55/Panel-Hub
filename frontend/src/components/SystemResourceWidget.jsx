import React, { useState, useEffect } from 'react';
import {
  Cpu,
  HardDrive,
  Activity,
  RefreshCw,
  Server,
  Clock,
  ArrowUpRight,
  ArrowDownLeft,
  ShieldCheck,
  AlertTriangle,
  Zap,
  RotateCcw,
  CheckCircle2
} from 'lucide-react';
import { serversApi } from '../api/client';
import { formatBytes } from '../utils/formatters';
import ConfirmModal from './ConfirmModal';

function formatUptime(seconds) {
  if (!seconds || isNaN(seconds)) return '0m';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);

  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function getProgressColor(percent) {
  if (percent >= 85) return 'bg-rose-500 text-rose-400';
  if (percent >= 70) return 'bg-amber-500 text-amber-400';
  return 'bg-emerald-500 text-emerald-400';
}

export default function SystemResourceWidget({ serverId, serverNickname }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const [isRestartModalOpen, setIsRestartModalOpen] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [restartFeedback, setRestartFeedback] = useState(null);

  const handleRestartXray = async () => {
    setRestarting(true);
    try {
      const res = await serversApi.restartXray(serverId);
      if (res.success) {
        if (res.status) {
          setStatus(res.status);
        } else {
          fetchStatus(true);
        }
        setRestartFeedback(res.message || 'Xray engine restarted successfully');
        setTimeout(() => setRestartFeedback(null), 4000);
        setIsRestartModalOpen(false);
      } else {
        alert(res.error || 'Failed to restart Xray');
      }
    } catch (err) {
      alert(err.response?.data?.error || err.message || 'Failed to restart Xray');
    } finally {
      setRestarting(false);
    }
  };

  const fetchStatus = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      setError(null);
      const res = await serversApi.getStatus(serverId);
      if (res.success && res.status) {
        setStatus(res.status);
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to fetch server metrics');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    // Refresh telemetry every 15 seconds
    const interval = setInterval(() => {
      fetchStatus();
    }, 15000);
    return () => clearInterval(interval);
  }, [serverId]);

  if (loading && !status) {
    return (
      <div className="p-3 sm:p-5 rounded-xl sm:rounded-2xl bg-slate-900/60 border border-slate-800 animate-pulse space-y-2.5">
        <div className="flex items-center justify-between mb-2">
          <div className="h-3.5 sm:h-4 w-28 sm:w-36 bg-slate-800 rounded"></div>
          <div className="h-3.5 sm:h-4 w-12 sm:w-16 bg-slate-800 rounded"></div>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          <div className="h-16 sm:h-20 bg-slate-800/60 rounded-lg sm:rounded-xl"></div>
          <div className="h-16 sm:h-20 bg-slate-800/60 rounded-lg sm:rounded-xl"></div>
          <div className="h-16 sm:h-20 bg-slate-800/60 rounded-lg sm:rounded-xl"></div>
        </div>
      </div>
    );
  }

  if (error && !status) {
    return (
      <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[11px] sm:text-xs text-slate-400 min-w-0">
          <AlertTriangle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400 shrink-0" />
          <span className="truncate">System metrics unavailable: {error}</span>
        </div>
        <button
          onClick={() => fetchStatus(true)}
          className="px-2.5 py-1 text-[11px] sm:text-xs text-slate-300 hover:text-white bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors shrink-0"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!status) return null;

  const cpuPercent = Math.min(100, Math.max(0, status.cpu?.percent || 0));
  const memPercent = Math.min(100, Math.max(0, status.mem?.percent || 0));
  const diskPercent = Math.min(100, Math.max(0, status.disk?.percent || 0));

  return (
    <div className="p-3 sm:p-5 rounded-xl sm:rounded-2xl bg-gradient-to-b from-slate-900/90 to-slate-900/50 border border-slate-800/80 shadow-xl backdrop-blur-sm space-y-2.5 sm:space-y-4">
      {/* Header bar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1 sm:p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shrink-0">
            <Activity className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-[11px] sm:text-xs font-bold text-white uppercase tracking-wider truncate">
              Instance Health & Resources
            </h3>
            <p className="text-[10px] sm:text-[11px] text-slate-400 truncate hidden xs:block">
              Live hardware telemetry from {serverNickname || '3x-ui instance'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {/* Uptime Pill */}
          {status.uptime > 0 && (
            <div className="flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg bg-slate-800/80 text-[10px] sm:text-[11px] text-slate-300 border border-slate-700/60 font-mono">
              <Clock className="w-3 h-3 text-slate-400 shrink-0" />
              <span>Up: {formatUptime(status.uptime)}</span>
            </div>
          )}

          {/* Xray State Badge */}
          {status.xray && (
            <div className="flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg bg-emerald-500/10 text-[10px] sm:text-[11px] text-emerald-400 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0"></span>
              <span className="font-semibold">{status.xray.version ? `v${status.xray.version}` : 'Running'}</span>
            </div>
          )}

          {/* Restart Xray Button (Desktop) */}
          <button
            onClick={() => setIsRestartModalOpen(true)}
            disabled={restarting}
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-[11px] text-amber-400 border border-amber-500/30 transition-all font-medium disabled:opacity-50"
            title="Restart Xray Core Engine"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${restarting ? 'animate-spin' : ''}`} />
            <span>Restart Xray</span>
          </button>

          {/* Manual Refresh */}
          <button
            onClick={() => fetchStatus(true)}
            disabled={refreshing}
            className="p-1 sm:p-1.5 text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 rounded-lg transition-all"
            title="Refresh metrics now"
          >
            <RefreshCw className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${refreshing ? 'animate-spin text-indigo-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main 3 Resource Cards (CPU, RAM, Storage) in a 3-column responsive layout */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3.5">
        {/* CPU Usage Card */}
        <div className="p-2 sm:p-4 rounded-xl bg-slate-950/60 border border-slate-800/90 relative overflow-hidden group hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between mb-1 sm:mb-2">
            <div className="flex items-center gap-1 sm:gap-2 min-w-0">
              <div className="p-1 sm:p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 shrink-0">
                <Cpu className="w-3 h-3 sm:w-4 sm:h-4" />
              </div>
              <span className="text-[10px] sm:text-xs font-semibold text-slate-300 truncate">CPU</span>
            </div>
            <span className="text-[11px] sm:text-xs font-mono font-bold text-white shrink-0">
              {cpuPercent}%
            </span>
          </div>

          <div className="w-full bg-slate-800/90 rounded-full h-1.5 sm:h-2 overflow-hidden mb-1 sm:mb-2">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                cpuPercent >= 85 ? 'bg-rose-500' : cpuPercent >= 70 ? 'bg-amber-500' : 'bg-indigo-500'
              }`}
              style={{ width: `${cpuPercent}%` }}
            ></div>
          </div>

          <div className="flex items-center justify-between text-[9px] sm:text-[11px] text-slate-400">
            <span className="truncate">{status.cpu?.cores || 1} Cores</span>
            {status.loads && status.loads.length > 0 && (
              <span className="hidden sm:inline font-mono text-[10px] text-slate-500 truncate">
                Load: {status.loads.slice(0, 3).join(', ')}
              </span>
            )}
          </div>
        </div>

        {/* RAM Usage Card */}
        <div className="p-2 sm:p-4 rounded-xl bg-slate-950/60 border border-slate-800/90 relative overflow-hidden group hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between mb-1 sm:mb-2">
            <div className="flex items-center gap-1 sm:gap-2 min-w-0">
              <div className="p-1 sm:p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 shrink-0">
                <Zap className="w-3 h-3 sm:w-4 sm:h-4" />
              </div>
              <span className="text-[10px] sm:text-xs font-semibold text-slate-300 truncate">RAM</span>
            </div>
            <span className="text-[11px] sm:text-xs font-mono font-bold text-white shrink-0">
              {memPercent}%
            </span>
          </div>

          <div className="w-full bg-slate-800/90 rounded-full h-1.5 sm:h-2 overflow-hidden mb-1 sm:mb-2">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                memPercent >= 85 ? 'bg-rose-500' : memPercent >= 70 ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${memPercent}%` }}
            ></div>
          </div>

          <div className="flex items-center justify-between text-[9px] sm:text-[11px] text-slate-400">
            <span className="truncate">{formatBytes(status.mem?.current || 0)}</span>
            <span className="hidden sm:inline text-slate-500 truncate">/ {formatBytes(status.mem?.total || 0)}</span>
          </div>
        </div>

        {/* Storage / Disk Card */}
        <div className="p-2 sm:p-4 rounded-xl bg-slate-950/60 border border-slate-800/90 relative overflow-hidden group hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between mb-1 sm:mb-2">
            <div className="flex items-center gap-1 sm:gap-2 min-w-0">
              <div className="p-1 sm:p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 shrink-0">
                <HardDrive className="w-3 h-3 sm:w-4 sm:h-4" />
              </div>
              <span className="text-[10px] sm:text-xs font-semibold text-slate-300 truncate">Disk</span>
            </div>
            <span className="text-[11px] sm:text-xs font-mono font-bold text-white shrink-0">
              {diskPercent}%
            </span>
          </div>

          <div className="w-full bg-slate-800/90 rounded-full h-1.5 sm:h-2 overflow-hidden mb-1 sm:mb-2">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                diskPercent >= 85 ? 'bg-rose-500' : diskPercent >= 70 ? 'bg-amber-500' : 'bg-cyan-500'
              }`}
              style={{ width: `${diskPercent}%` }}
            ></div>
          </div>

          <div className="flex items-center justify-between text-[9px] sm:text-[11px] text-slate-400">
            <span className="truncate">{formatBytes(status.disk?.current || 0)}</span>
            <span className="hidden sm:inline text-slate-500 truncate">/ {formatBytes(status.disk?.total || 0)}</span>
          </div>
        </div>
      </div>

      {/* Secondary Telemetry Strip: Real-time network throughput and socket connections */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-2.5 pt-0.5 sm:pt-1">
        <div className="flex items-center gap-1.5 sm:gap-2 p-2 sm:p-2.5 rounded-lg sm:rounded-xl bg-slate-950/40 border border-slate-800/60">
          <ArrowUpRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400 shrink-0" />
          <div className="min-w-0 flex-1">
            <span className="text-[9px] sm:text-[10px] text-slate-500 block uppercase font-bold truncate">Upload</span>
            <span className="font-mono text-slate-200 font-semibold text-[10px] sm:text-[11px] truncate block">
              {formatBytes(status.netIO?.up || 0)}/s
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 p-2 sm:p-2.5 rounded-lg sm:rounded-xl bg-slate-950/40 border border-slate-800/60">
          <ArrowDownLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-400 shrink-0" />
          <div className="min-w-0 flex-1">
            <span className="text-[9px] sm:text-[10px] text-slate-500 block uppercase font-bold truncate">Download</span>
            <span className="font-mono text-slate-200 font-semibold text-[10px] sm:text-[11px] truncate block">
              {formatBytes(status.netIO?.down || 0)}/s
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 p-2 sm:p-2.5 rounded-lg sm:rounded-xl bg-slate-950/40 border border-slate-800/60">
          <Server className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-400 shrink-0" />
          <div className="min-w-0 flex-1">
            <span className="text-[9px] sm:text-[10px] text-slate-500 block uppercase font-bold truncate">Sockets</span>
            <span className="font-mono text-slate-200 font-semibold text-[10px] sm:text-[11px] truncate block">
              {status.tcpCount || 0} TCP • {status.udpCount || 0} UDP
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 p-2 sm:p-2.5 rounded-lg sm:rounded-xl bg-slate-950/40 border border-slate-800/60">
          <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400 shrink-0" />
          <div className="min-w-0 flex-1">
            <span className="text-[9px] sm:text-[10px] text-slate-500 block uppercase font-bold truncate">Total Traffic</span>
            <span className="font-mono text-slate-200 font-semibold text-[10px] sm:text-[11px] truncate block">
              {formatBytes((status.netTraffic?.sent || 0) + (status.netTraffic?.recv || 0))}
            </span>
          </div>
        </div>
      </div>

      {/* Restart Feedback Toast */}
      {restartFeedback && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{restartFeedback}</span>
        </div>
      )}

      {/* Confirm Restart Modal */}
      <ConfirmModal
        isOpen={isRestartModalOpen}
        onClose={() => setIsRestartModalOpen(false)}
        onConfirm={handleRestartXray}
        title="Restart Xray Core Engine"
        message="Are you sure you want to restart the Xray engine on this server? Active proxy client connections will momentarily disconnect and reconnect automatically within 1-2 seconds."
        confirmText="Restart Xray"
        danger={true}
        loading={restarting}
      />
    </div>
  );
}
