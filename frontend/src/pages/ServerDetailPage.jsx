import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  RefreshCw,
  HardDrive,
  Users,
  Radio,
  ArrowUpRight,
  ArrowDownLeft,
  CheckCircle2,
  XCircle,
  ExternalLink,
  ChevronRight,
  AlertCircle,
  Bell,
  RotateCcw
} from 'lucide-react';
import { serversApi } from '../api/client';
import { formatBytes } from '../utils/formatters';
import SystemResourceWidget from '../components/SystemResourceWidget';
import AlertSettingsModal from '../components/AlertSettingsModal';
import ConfirmModal from '../components/ConfirmModal';

export default function ServerDetailPage({ server, onBack, onSelectInbound }) {
  const [currentServer, setCurrentServer] = useState(server);
  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
  const [isRestartXrayModalOpen, setIsRestartXrayModalOpen] = useState(false);
  const [restartingXray, setRestartingXray] = useState(false);
  const [restartFeedback, setRestartFeedback] = useState(null);
  const [inbounds, setInbounds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const handleRestartXray = async () => {
    setRestartingXray(true);
    try {
      const res = await serversApi.restartXray(server._id);
      if (res.success) {
        setRestartFeedback(res.message || 'Xray engine restarted successfully');
        setTimeout(() => setRestartFeedback(null), 4000);
        setIsRestartXrayModalOpen(false);
        fetchData();
      } else {
        alert(res.error || 'Failed to restart Xray');
      }
    } catch (err) {
      alert(err.response?.data?.error || err.message || 'Failed to restart Xray');
    } finally {
      setRestartingXray(false);
    }
  };

  const fetchData = async () => {
    try {
      setError(null);
      const [serverRes, inboundsRes] = await Promise.allSettled([
        serversApi.get(server._id),
        serversApi.getInbounds(server._id)
      ]);

      if (serverRes.status === 'fulfilled' && serverRes.value?.success && serverRes.value?.server) {
        setCurrentServer(serverRes.value.server);
      }
      if (inboundsRes.status === 'fulfilled' && inboundsRes.value?.success) {
        setInbounds(inboundsRes.value.inbounds || []);
      } else if (inboundsRes.status === 'rejected') {
        const err = inboundsRes.reason;
        setError(err.response?.data?.error || err.message || 'Failed to fetch inbounds from panel');
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to fetch inbounds from panel');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [server._id]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const getProtocolBadge = (protocol) => {
    const p = (protocol || '').toLowerCase();
    switch (p) {
      case 'vless':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 uppercase">VLESS</span>;
      case 'vmess':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30 uppercase">VMESS</span>;
      case 'trojan':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 uppercase">TROJAN</span>;
      case 'shadowsocks':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-purple-500/20 text-purple-400 border border-purple-500/30 uppercase">SHADOWSOCKS</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-700 text-slate-300 uppercase">{protocol || 'UNKNOWN'}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <button
            onClick={onBack}
            className="p-2 text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/80 rounded-xl transition-all shrink-0"
            title="Back to Servers"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-slate-400">Servers</span>
              <span className="text-xs text-slate-600">/</span>
              <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight truncate max-w-[200px] sm:max-w-none">{server.nickname}</h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                Live Inbounds
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5 truncate max-w-[260px] sm:max-w-none">{server.panelUrl}</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsRestartXrayModalOpen(true)}
            disabled={restartingXray}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-amber-300 hover:text-white bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-xl transition-all disabled:opacity-50"
            title="Restart Xray Core Engine"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${restartingXray ? 'animate-spin' : ''}`} />
            <span>Restart Xray</span>
          </button>

          <button
            onClick={() => setIsAlertModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/80 rounded-xl transition-all"
            title="Configure Brevo Alert Settings"
          >
            <Bell className="w-3.5 h-3.5 text-indigo-400" />
            <span>Alert Settings</span>
          </button>

          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/80 rounded-xl transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Sync Panel</span>
          </button>
        </div>
      </div>

      {/* Restart Feedback Notification */}
      {restartFeedback && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{restartFeedback}</span>
        </div>
      )}

      {/* Instance Hardware & System Resources (CPU, RAM, Disk, Uptime) */}
      <SystemResourceWidget serverId={server._id} serverNickname={server.nickname} />

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-xs font-semibold">Panel Proxy Error</h4>
            <p className="text-xs text-rose-300/90 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Inbounds Table */}
      {loading ? (
        <div className="py-20 text-center text-slate-500">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
          <p className="text-xs">Logging into 3x-ui panel & querying live inbounds...</p>
        </div>
      ) : inbounds.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/30">
          <HardDrive className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-white mb-1">No Inbounds Configured</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            This 3x-ui panel does not have any inbounds configured yet. Create one in your panel WebUI or import rules.
          </p>
        </div>
      ) : (
        <>
          {/* Mobile Inbound Cards View (< md): Independent individual cards with distinct spacing & borders */}
          <div className="md:hidden space-y-3.5">
            {inbounds.map((inbound) => (
              <div
                key={inbound.id}
                onClick={() => onSelectInbound(inbound)}
                className="p-4 rounded-2xl border border-slate-800 bg-slate-900/80 shadow-lg space-y-3.5 hover:border-indigo-500/40 transition-all cursor-pointer group"
              >
                {/* Header: Remark, Protocol, Port, Status */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-white truncate max-w-[200px]">
                        {inbound.remark}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">#{inbound.id}</span>
                    </div>
                    {inbound.tag && (
                      <p className="text-[11px] text-slate-500 font-mono mt-0.5 truncate">{inbound.tag}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {getProtocolBadge(inbound.protocol)}
                    {inbound.enable ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                        Enabled
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                        Disabled
                      </span>
                    )}
                  </div>
                </div>

                {/* Metrics: Port, Quota, Traffic */}
                <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/60 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-500 block">Port & Quota</span>
                    <div className="flex items-center gap-1.5 mt-0.5 font-mono">
                      <span className="font-semibold text-indigo-300">:{inbound.port}</span>
                      <span className="text-slate-600">•</span>
                      <span className="text-slate-400">{inbound.total > 0 ? formatBytes(inbound.total) : 'Unlimited'}</span>
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-500 block">Live Traffic</span>
                    <div className="flex items-center gap-2 mt-0.5 text-[11px]">
                      <span className="text-emerald-400 font-mono flex items-center gap-0.5">
                        <ArrowUpRight className="w-3 h-3" />
                        {formatBytes(inbound.up)}
                      </span>
                      <span className="text-blue-400 font-mono flex items-center gap-0.5">
                        <ArrowDownLeft className="w-3 h-3" />
                        {formatBytes(inbound.down)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Action button: Manage Clients */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectInbound(inbound);
                  }}
                  className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-indigo-600/90 hover:bg-indigo-600 text-white shadow-sm transition-all"
                >
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-indigo-200" />
                    <span>Manage Clients ({inbound.clientCount || 0})</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-indigo-200" />
                </button>
              </div>
            ))}
          </div>

          {/* Desktop Table View (>= md) */}
          <div className="hidden md:block rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden shadow-xl">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Live Inbounds</h3>
              <span className="text-xs text-slate-500">{inbounds.length} active inbounds</span>
            </div>
            <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-800/50 text-slate-400 border-b border-slate-800 uppercase tracking-wider font-semibold text-[10px]">
                <tr>
                  <th className="px-6 py-3">Inbound / Tag</th>
                  <th className="px-4 py-3">Protocol</th>
                  <th className="px-4 py-3">Port</th>
                  <th className="px-4 py-3">Traffic (Up / Down)</th>
                  <th className="px-4 py-3">Total Quota</th>
                  <th className="px-4 py-3">Clients</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-6 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {inbounds.map((inbound) => {
                  return (
                    <tr
                      key={inbound.id}
                      onClick={() => onSelectInbound(inbound)}
                      className="hover:bg-slate-800/40 cursor-pointer transition-colors group"
                    >
                      <td className="px-6 py-4 font-medium text-white">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold group-hover:text-indigo-400 transition-colors">
                            {inbound.remark}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">#{inbound.id}</span>
                        </div>
                        {inbound.tag && (
                          <div className="text-[11px] text-slate-500 font-mono">{inbound.tag}</div>
                        )}
                      </td>

                      <td className="px-4 py-4">
                        {getProtocolBadge(inbound.protocol)}
                      </td>

                      <td className="px-4 py-4 font-mono font-medium text-indigo-300">
                        {inbound.port}
                      </td>

                      <td className="px-4 py-4">
                        <div className="flex flex-col gap-0.5">
                          <span className="flex items-center gap-1 text-[11px] text-emerald-400">
                            <ArrowUpRight className="w-3 h-3" />
                            {formatBytes(inbound.up)}
                          </span>
                          <span className="flex items-center gap-1 text-[11px] text-blue-400">
                            <ArrowDownLeft className="w-3 h-3" />
                            {formatBytes(inbound.down)}
                          </span>
                        </div>
                      </td>

                      <td className="px-4 py-4 text-slate-400">
                        {inbound.total > 0 ? formatBytes(inbound.total) : 'Unlimited'}
                      </td>

                      <td className="px-4 py-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-800 text-slate-200 border border-slate-700/80">
                          <Users className="w-3.5 h-3.5 text-indigo-400" />
                          <span>{inbound.clientCount}</span>
                        </span>
                      </td>

                      <td className="px-4 py-4">
                        {inbound.enable ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Enabled</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 font-medium">
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Disabled</span>
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => onSelectInbound(inbound)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition-all"
                        >
                          <span>Manage Clients</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </>
    )}

      {/* Alert Settings Modal */}
      <AlertSettingsModal
        isOpen={isAlertModalOpen}
        onClose={() => setIsAlertModalOpen(false)}
        server={currentServer}
        onSaved={(updated) => setCurrentServer(updated)}
      />

      {/* Confirm Restart Xray Modal */}
      <ConfirmModal
        isOpen={isRestartXrayModalOpen}
        onClose={() => setIsRestartXrayModalOpen(false)}
        onConfirm={handleRestartXray}
        title="Restart Xray Core Engine"
        message={`Are you sure you want to restart the Xray engine on "${server.nickname}"? Active proxy client connections will momentarily disconnect and reconnect automatically within 1-2 seconds.`}
        confirmText="Restart Xray"
        danger={true}
        loading={restartingXray}
      />
    </div>
  );
}
