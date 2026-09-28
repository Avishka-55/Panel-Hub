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
      <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 animate-pulse">
        <div className="flex items-center justify-between mb-4">
          <div className="h-4 w-36 bg-slate-800 rounded"></div>
          <div className="h-4 w-16 bg-slate-800 rounded"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="h-20 bg-slate-800/60 rounded-xl"></div>
          <div className="h-20 bg-slate-800/60 rounded-xl"></div>
          <div className="h-20 bg-slate-800/60 rounded-xl"></div>
        </div>
      </div>
    );
  }

  if (error && !status) {
    return (
      <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center gap-2.5 text-xs text-slate-400">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          <span>System metrics currently unavailable: {error}</span>
        </div>
        <button
          onClick={() => fetchStatus(true)}
          className="px-2.5 py-1 text-xs text-slate-300 hover:text-white bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors"
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
    <div className="p-5 rounded-2xl bg-gradient-to-b from-slate-900/90 to-slate-900/50 border border-slate-800/80 shadow-xl backdrop-blur-sm space-y-4">
      {/* Header bar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Instance Health & Resources
            </h3>
            <p className="text-[11px] text-slate-400">
              Live hardware telemetry from {serverNickname || '3x-ui instance'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Uptime Pill */}
          {status.uptime > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/80 text-[11px] text-slate-300 border border-slate-700/60 font-mono">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>Up: {formatUptime(status.uptime)}</span>
            </div>
          )}

          {/* Xray State Badge */}
          {status.xray && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-[11px] text-emerald-400 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="font-semibold">Xray {status.xray.version ? `v${status.xray.version}` : 'Running'}</span>
            </div>
          )}

          {/* Restart Xray Button */}
          <button
            onClick={() => setIsRestartModalOpen(true)}
            disabled={restarting}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-[11px] text-amber-400 border border-amber-500/30 transition-all font-medium disabled:opacity-50"
            title="Restart Xray Core Engine"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${restarting ? 'animate-spin' : ''}`} />
            <span>Restart Xray</span>
          </button>

          {/* Manual Refresh */}
          <button
            onClick={() => fetchStatus(true)}
            disabled={refreshing}
            className="p-1.5 text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 rounded-lg transition-all"
            title="Refresh metrics now"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-indigo-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main 3 Resource Cards (CPU, RAM, Storage) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        {/* CPU Usage Card */}
        <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/90 relative overflow-hidden group hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
                <Cpu className="w-4 h-4" />
              </div>
              <span className="text-xs font-semibold text-slate-300">CPU Load</span>
            </div>
            <span className="text-xs font-mono font-bold text-white">
              {cpuPercent}%
            </span>
          </div>

          <div className="w-full bg-slate-800/90 rounded-full h-2 overflow-hidden mb-2">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                cpuPercent >= 85 ? 'bg-rose-500' : cpuPercent >= 70 ? 'bg-amber-500' : 'bg-indigo-500'
              }`}
              style={{ width: `${cpuPercent}%` }}
            ></div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>{status.cpu?.cores || 1} Cores</span>
            {status.loads && status.loads.length > 0 && (
              <span className="font-mono text-[10px] text-slate-500">
                Load: {status.loads.slice(0, 3).join(', ')}
              </span>
            )}
          </div>
        </div>

        {/* RAM Usage Card */}
        <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/90 relative overflow-hidden group hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                <Zap className="w-4 h-4" />
              </div>
              <span className="text-xs font-semibold text-slate-300">Memory (RAM)</span>
            </div>
            <span className="text-xs font-mono font-bold text-white">
              {memPercent}%
            </span>
          </div>

          <div className="w-full bg-slate-800/90 rounded-full h-2 overflow-hidden mb-2">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                memPercent >= 85 ? 'bg-rose-500' : memPercent >= 70 ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${memPercent}%` }}
            ></div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>{formatBytes(status.mem?.current || 0)} used</span>
            <span className="text-slate-500">Total: {formatBytes(status.mem?.total || 0)}</span>
          </div>
        </div>

        {/* Storage / Disk Card */}
        <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/90 relative overflow-hidden group hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400">
                <HardDrive className="w-4 h-4" />
              </div>
              <span className="text-xs font-semibold text-slate-300">Storage (Disk)</span>
            </div>
            <span className="text-xs font-mono font-bold text-white">
              {diskPercent}%
            </span>
          </div>

          <div className="w-full bg-slate-800/90 rounded-full h-2 overflow-hidden mb-2">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                diskPercent >= 85 ? 'bg-rose-500' : diskPercent >= 70 ? 'bg-amber-500' : 'bg-cyan-500'
              }`}
              style={{ width: `${diskPercent}%` }}
            ></div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>{formatBytes(status.disk?.current || 0)} used</span>
            <span className="text-slate-500">Total: {formatBytes(status.disk?.total || 0)}</span>
          </div>
        </div>
      </div>

      {/* Secondary Telemetry Strip: Real-time network throughput and socket connections */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1 text-xs">
        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-950/40 border border-slate-800/60">
          <ArrowUpRight className="w-4 h-4 text-emerald-400 shrink-0" />
          <div className="overflow-hidden">
            <span className="text-[10px] text-slate-500 block uppercase font-bold">Upload I/O</span>
            <span className="font-mono text-slate-200 font-semibold text-[11px] truncate block">
              {formatBytes(status.netIO?.up || 0)}/s
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-950/40 border border-slate-800/60">
          <ArrowDownLeft className="w-4 h-4 text-cyan-400 shrink-0" />
          <div className="overflow-hidden">
            <span className="text-[10px] text-slate-500 block uppercase font-bold">Download I/O</span>
            <span className="font-mono text-slate-200 font-semibold text-[11px] truncate block">
              {formatBytes(status.netIO?.down || 0)}/s
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-950/40 border border-slate-800/60">
          <Server className="w-4 h-4 text-indigo-400 shrink-0" />
          <div className="overflow-hidden">
            <span className="text-[10px] text-slate-500 block uppercase font-bold">Connections</span>
            <span className="font-mono text-slate-200 font-semibold text-[11px] truncate block">
              {status.tcpCount || 0} TCP • {status.udpCount || 0} UDP
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-950/40 border border-slate-800/60">
          <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
          <div className="overflow-hidden">
            <span className="text-[10px] text-slate-500 block uppercase font-bold">Total Bandwidth</span>
            <span className="font-mono text-slate-200 font-semibold text-[11px] truncate block">
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
