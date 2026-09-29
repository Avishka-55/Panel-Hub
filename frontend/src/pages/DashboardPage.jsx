import React, { useState, useEffect } from 'react';
import {
  Server,
  Plus,
  RefreshCw,
  Activity,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Trash2,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Radio,
  Clock,
  HardDrive,
  Bell,
  BellOff,
  Zap,
  ShieldAlert,
  Mail
} from 'lucide-react';
import { serversApi } from '../api/client';
import AddServerModal from '../components/AddServerModal';
import ConfirmModal from '../components/ConfirmModal';
import AlertSettingsModal from '../components/AlertSettingsModal';
import DailyReportModal from '../components/DailyReportModal';

export default function DashboardPage({ onSelectServer, onServerCountChange }) {
  const [servers, setServers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [checkingHealth, setCheckingHealth] = useState(false);
  const [healthStatusMsg, setHealthStatusMsg] = useState(null);
  const [error, setError] = useState(null);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [serverToDelete, setServerToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [serverForAlertModal, setServerForAlertModal] = useState(null);
  const [testingServerId, setTestingServerId] = useState(null);

  useEffect(() => {
    onServerCountChange?.(servers.length);
  }, [servers, onServerCountChange]);

  const fetchServers = async () => {
    try {
      const res = await serversApi.list();
      if (res.success) {
        setServers(res.servers || []);
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to fetch servers');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchServers();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchServers();
  };

  const handleCheckAllHealth = async () => {
    setCheckingHealth(true);
    setHealthStatusMsg(null);
    try {
      const res = await serversApi.checkAllHealth();
      if (res.success) {
        if (res.servers) {
          setServers(res.servers);
        }
        const online = (res.results || []).filter(r => r.status === 'online').length;
        const total = (res.results || []).length;
        setHealthStatusMsg(`Health sweep complete: ${online}/${total} panels online`);
        setTimeout(() => setHealthStatusMsg(null), 6000);
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to complete health check');
    } finally {
      setCheckingHealth(false);
    }
  };

  const handleToggleAlerts = async (e, server) => {
    e.stopPropagation();
    const currentAlerts = server.monitoring?.emailAlerts !== false;
    try {
      const res = await serversApi.updateMonitoring(server._id, {
        emailAlerts: !currentAlerts
      });
      if (res.success) {
        setServers(prev =>
          prev.map(s =>
            s._id === server._id
              ? { ...s, monitoring: { ...(s.monitoring || {}), emailAlerts: !currentAlerts } }
              : s
          )
        );
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update alert settings');
    }
  };

  const handleServerAdded = (newServer) => {
    setServers((prev) => [newServer, ...prev]);
  };

  const handleDeleteServer = async () => {
    if (!serverToDelete) return;
    setDeleteLoading(true);
    try {
      await serversApi.delete(serverToDelete._id);
      setServers((prev) => prev.filter((s) => s._id !== serverToDelete._id));
      setServerToDelete(null);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete server');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleTestConnection = async (e, serverId) => {
    e.stopPropagation();
    setTestingServerId(serverId);
    try {
      const res = await serversApi.testConnection(serverId);
      if (res.success) {
        setServers((prev) =>
          prev.map((s) =>
            s._id === serverId
              ? { ...s, status: 'online', inboundCount: res.inboundCount, lastConnectedAt: new Date() }
              : s
          )
        );
      }
    } catch (err) {
      const errMsg = err.response?.data?.error || err.message;
      setServers((prev) =>
        prev.map((s) =>
          s._id === serverId ? { ...s, status: 'offline', lastError: errMsg } : s
        )
      );
    } finally {
      setTestingServerId(null);
    }
  };

  const onlineServersCount = servers.filter((s) => s.status === 'online').length;
  const totalInboundsCount = servers.reduce((acc, s) => acc + (s.inboundCount || 0), 0);

  return (
    <div className="space-y-6">
      {/* Top action header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Connected 3x-ui Panels</h2>
          <p className="text-xs text-slate-400">
            Monitor and manage multiple distributed VPN nodes from a single dashboard
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          <button
            onClick={handleCheckAllHealth}
            disabled={checkingHealth}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-emerald-300 hover:text-emerald-200 bg-emerald-950/40 hover:bg-emerald-900/50 border border-emerald-500/30 rounded-xl transition-all shadow-sm"
            title="Scan all connected panels for health and update telemetry"
          >
            <Activity className={`w-3.5 h-3.5 ${checkingHealth ? 'animate-pulse text-emerald-400' : 'text-emerald-400'}`} />
            <span>{checkingHealth ? 'Scanning Health...' : 'Check All Health'}</span>
          </button>

          <button
            onClick={() => setIsReportModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-indigo-300 hover:text-indigo-200 bg-indigo-950/40 hover:bg-indigo-900/50 border border-indigo-500/30 rounded-xl transition-all shadow-sm"
            title="Daily Operations & Bandwidth Digest"
          >
            <Mail className="w-3.5 h-3.5 text-indigo-400" />
            <span>Daily Report</span>
          </button>

          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/80 rounded-xl transition-all"
            title="Refresh Server List"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-lg shadow-indigo-600/30 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Connect Panel</span>
          </button>
        </div>
      </div>

      {/* Health sweep status toast */}
      {healthStatusMsg && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center justify-between text-xs text-emerald-300 animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{healthStatusMsg}</span>
          </div>
          <button onClick={() => setHealthStatusMsg(null)} className="text-emerald-400 hover:text-white text-base leading-none px-1">&times;</button>
        </div>
      )}

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Total Panels</span>
            <Server className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold text-white">{servers.length}</div>
          <div className="text-[11px] text-slate-500 mt-1">Configured endpoints</div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Online Status</span>
            <Activity className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400">
            {onlineServersCount} <span className="text-xs font-normal text-slate-400">/ {servers.length}</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Reachable panels</div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Active Inbounds</span>
            <HardDrive className="w-4 h-4 text-violet-400" />
          </div>
          <div className="text-2xl font-bold text-white">{totalInboundsCount}</div>
          <div className="text-[11px] text-slate-500 mt-1">Queried live</div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Security Mode</span>
            <ShieldCheck className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-sm font-bold text-indigo-300 mt-1">AES-256-GCM</div>
          <div className="text-[11px] text-slate-500 mt-1">Strict In-Memory Vault</div>
        </div>
      </div>

      {/* Servers Table / Cards View */}
      {loading ? (
        <div className="py-16 text-center text-slate-500">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
          <p className="text-xs">Loading connected servers...</p>
        </div>
      ) : servers.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/30">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center mx-auto mb-4">
            <Server className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-white mb-1">No 3x-ui Panels Connected</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mb-6">
            Add your first 3x-ui panel instance using its URL and admin credentials. Password is encrypted using AES-256-GCM before saving.
          </p>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-lg shadow-indigo-600/30 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Connect First Panel</span>
          </button>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden shadow-xl">
          <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Configured VPN Panels</h3>
            <span className="text-xs text-slate-500">{servers.length} instances</span>
          </div>

          <div className="divide-y divide-slate-800/80">
            {servers.map((server) => {
              const isTesting = testingServerId === server._id;
              const isOnline = server.status === 'online';

              return (
                <div
                  key={server._id}
                  onClick={() => onSelectServer(server)}
                  className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-800/40 cursor-pointer transition-colors group"
                >
                  <div className="flex items-start sm:items-center gap-3.5">
                    <div
                      className={`p-2.5 rounded-xl border mt-0.5 sm:mt-0 ${
                        isOnline
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : server.status === 'error' || server.status === 'offline'
                          ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}
                    >
                      <Server className="w-5 h-5" />
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-white group-hover:text-indigo-400 transition-colors">
                          {server.nickname}
                        </span>

                        {isOnline ? (
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                            Online
                          </span>
                        ) : server.status === 'error' || server.status === 'offline' ? (
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                            Offline
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                            Untested
                          </span>
                        )}

                        {server.authType === 'api_key' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                            API Token
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                            Password
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-slate-400">
                        <span className="font-mono text-slate-300">{server.panelUrl}</span>
                        <span>•</span>
                        {server.authType === 'api_key' ? (
                          <span>Auth: <strong className="text-indigo-400">Bearer Token</strong></span>
                        ) : (
                          <span>User: <strong className="text-slate-300">{server.panelUsername}</strong></span>
                        )}
                        <span>•</span>
                        <span>
                          Inbounds: <strong className="text-slate-200">{server.inboundCount || 0}</strong>
                        </span>
                        {server.lastConnectedAt && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1 text-slate-500">
                              <Clock className="w-3 h-3" />
                              {new Date(server.lastConnectedAt).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </>
                        )}
                      </div>

                      {server.telemetry && server.telemetry.cpu !== undefined && isOnline && (
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800/90 text-slate-300 border border-slate-700/60">
                            <Zap className="w-3 h-3 text-amber-400" />
                            CPU: <strong className={server.telemetry.cpu >= 80 ? 'text-rose-400' : 'text-slate-200'}>{server.telemetry.cpu}%</strong>
                          </span>
                          <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800/90 text-slate-300 border border-slate-700/60">
                            RAM: <strong className={server.telemetry.memPercent >= 80 ? 'text-rose-400' : 'text-slate-200'}>{server.telemetry.memPercent}%</strong>
                          </span>
                          {server.telemetry.xrayState && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              Xray: {server.telemetry.xrayState}
                            </span>
                          )}
                        </div>
                      )}

                      {server.lastError && (
                        <p className="mt-1 text-[11px] text-rose-400/90 truncate max-w-md">
                          Error: {server.lastError}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 self-end md:self-center" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setServerForAlertModal(server);
                      }}
                      className={`p-1.5 rounded-lg border transition-all ${
                        server.monitoring?.emailAlerts !== false
                          ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/20'
                          : 'text-slate-500 bg-slate-800/40 border-slate-700/50 hover:text-slate-300'
                      }`}
                      title="Customize Brevo Alert Rules & Notifications"
                    >
                      {server.monitoring?.emailAlerts !== false ? (
                        <Bell className="w-3.5 h-3.5" />
                      ) : (
                        <BellOff className="w-3.5 h-3.5" />
                      )}
                    </button>

                    <button
                      onClick={(e) => handleTestConnection(e, server._id)}
                      disabled={isTesting}
                      className="px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700 border border-slate-700/80 rounded-lg transition-all"
                      title="Test live connection to 3x-ui"
                    >
                      {isTesting ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <span>Test Link</span>
                      )}
                    </button>

                    <button
                      onClick={() => onSelectServer(server)}
                      className="flex items-center gap-1 px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-sm transition-all"
                    >
                      <span>Inbounds</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => setServerToDelete(server)}
                      className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                      title="Remove Server"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add Server Modal */}
      <AddServerModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onServerAdded={handleServerAdded}
      />

      {/* Confirm Delete Server Modal */}
      <ConfirmModal
        isOpen={!!serverToDelete}
        onClose={() => setServerToDelete(null)}
        onConfirm={handleDeleteServer}
        title="Remove 3x-ui Panel"
        message={`Are you sure you want to disconnect "${serverToDelete?.nickname}"? This only removes the connection entry from PanelHub; the actual remote server and its clients will remain untouched.`}
        confirmText="Remove Server"
        danger={true}
        loading={deleteLoading}
      />

      {/* Alert Settings Modal */}
      <AlertSettingsModal
        isOpen={!!serverForAlertModal}
        onClose={() => setServerForAlertModal(null)}
        server={serverForAlertModal}
        onSaved={(updated) => {
          setServers((prev) => prev.map((s) => (s._id === updated._id ? updated : s)));
          setServerForAlertModal(null);
        }}
      />

      {/* Daily Operations Report Modal */}
      <DailyReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
      />
    </div>
  );
}
