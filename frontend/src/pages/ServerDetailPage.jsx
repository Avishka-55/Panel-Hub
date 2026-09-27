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
  AlertCircle
} from 'lucide-react';
import { serversApi } from '../api/client';
import { formatBytes } from '../utils/formatters';

export default function ServerDetailPage({ server, onBack, onSelectInbound }) {
  const [inbounds, setInbounds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const fetchInbounds = async () => {
    try {
      setError(null);
      const res = await serversApi.getInbounds(server._id);
      if (res.success) {
        setInbounds(res.inbounds || []);
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to fetch inbounds from panel');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchInbounds();
  }, [server._id]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchInbounds();
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
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/80 rounded-xl transition-all"
            title="Back to Servers"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Servers</span>
              <span className="text-xs text-slate-600">/</span>
              <h2 className="text-xl font-bold text-white tracking-tight">{server.nickname}</h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Live Inbounds
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5">{server.panelUrl}</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
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
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden shadow-xl">
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
      )}
    </div>
  );
}
