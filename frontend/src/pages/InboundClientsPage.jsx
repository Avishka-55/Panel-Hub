import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  RefreshCw,
  UserPlus,
  Edit2,
  Trash2,
  RotateCcw,
  Copy,
  Check,
  Search,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Calendar,
  HardDrive,
  Users,
  QrCode,
  Link2,
  Power,
  PowerOff,
  Loader2
} from 'lucide-react';
import { serversApi } from '../api/client';
import { formatBytes, formatExpiry, isExpired, formatShortId, formatRelativeTime } from '../utils/formatters';
import EditClientModal from '../components/EditClientModal';
import AddClientModal from '../components/AddClientModal';
import ConfirmModal from '../components/ConfirmModal';
import ClientQrModal from '../components/ClientQrModal';

export default function InboundClientsPage({ server, inbound, onBack }) {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'active' | 'disabled'

  // Modals state
  const [editingClient, setEditingClient] = useState(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [qrModalClient, setQrModalClient] = useState(null);

  const [clientToDelete, setClientToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [clientToReset, setClientToReset] = useState(null);
  const [resetLoading, setResetLoading] = useState(false);

  // Single client toggle state
  const [togglingClientId, setTogglingClientId] = useState(null);

  // Bulk activate/deactivate state
  const [bulkAction, setBulkAction] = useState(null); // 'activate_all' | 'deactivate_all' | null
  const [bulkLoading, setBulkLoading] = useState(false);

  // Copy feedback state
  const [copiedId, setCopiedId] = useState(null);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchClients = async () => {
    try {
      setError(null);
      const res = await serversApi.getInboundClients(server._id, inbound.id);
      if (res.success) {
        setClients(res.clients || []);
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to fetch live clients');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, [server._id, inbound.id]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchClients();
  };

  const handleCopyId = (id) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Client Update Handler (from Edit Modal)
  const handleClientUpdated = (updatedClient) => {
    setClients((prev) =>
      prev.map((c) => (c.id === updatedClient.id ? { ...c, ...updatedClient } : c))
    );
    showToast(`Client "${updatedClient.email || updatedClient.id}" updated successfully`);
  };

  // 1-Click Activate / Deactivate Single Client
  const handleToggleEnable = async (client) => {
    const currentEnabled = client.enable !== false;
    const nextState = !currentEnabled;
    setTogglingClientId(client.id);
    try {
      const res = await serversApi.updateClient(server._id, client.id, {
        inboundId: inbound.id,
        enable: nextState,
        email: client.email
      });

      if (res.success) {
        setClients((prev) =>
          prev.map((c) => (c.id === client.id ? { ...c, enable: nextState } : c))
        );
        showToast(
          nextState
            ? `Client "${client.email || client.id}" activated`
            : `Client "${client.email || client.id}" deactivated`
        );
      } else {
        alert(res.error || 'Failed to update client status');
      }
    } catch (err) {
      alert(err.response?.data?.error || err.message || 'Failed to update client status');
    } finally {
      setTogglingClientId(null);
    }
  };

  // Bulk Activate / Deactivate All Clients on Inbound
  const handleBulkToggle = async (targetState) => {
    setBulkLoading(true);
    try {
      const clientsToUpdate = clients.filter((c) => (c.enable !== false) !== targetState);
      if (clientsToUpdate.length === 0) {
        showToast(`All clients are already ${targetState ? 'active' : 'disabled'}`);
        setBulkAction(null);
        return;
      }

      let successCount = 0;
      await Promise.allSettled(
        clientsToUpdate.map(async (c) => {
          try {
            const res = await serversApi.updateClient(server._id, c.id, {
              inboundId: inbound.id,
              enable: targetState,
              email: c.email
            });
            if (res.success) successCount++;
          } catch (_) {}
        })
      );

      setClients((prev) =>
        prev.map((c) => ({ ...c, enable: targetState }))
      );
      showToast(
        targetState
          ? `Activated ${successCount} client(s)`
          : `Deactivated ${successCount} client(s)`
      );
      setBulkAction(null);
    } catch (err) {
      alert(err.response?.data?.error || err.message || 'Failed to update clients');
    } finally {
      setBulkLoading(false);
    }
  };

  // Client Add Handler
  const handleClientAdded = (newClient) => {
    fetchClients();
    showToast(`Client "${newClient.email}" provisioned successfully`);
  };

  // Client Delete Handler
  const handleDeleteClient = async () => {
    if (!clientToDelete) return;
    setDeleteLoading(true);
    try {
      await serversApi.deleteClient(server._id, clientToDelete.id, inbound.id);
      setClients((prev) => prev.filter((c) => c.id !== clientToDelete.id));
      showToast(`Client "${clientToDelete.email || clientToDelete.id}" deleted`);
      setClientToDelete(null);
    } catch (err) {
      alert(err.response?.data?.error || err.message || 'Failed to delete client');
    } finally {
      setDeleteLoading(false);
    }
  };

  // Reset Traffic Handler
  const handleResetTraffic = async () => {
    if (!clientToReset) return;
    setResetLoading(true);
    try {
      await serversApi.resetClientTraffic(server._id, clientToReset.id, inbound.id);
      setClients((prev) =>
        prev.map((c) => (c.id === clientToReset.id ? { ...c, up: 0, down: 0 } : c))
      );
      showToast(`Traffic counters reset for ${clientToReset.email || clientToReset.id}`);
      setClientToReset(null);
    } catch (err) {
      alert(err.response?.data?.error || err.message || 'Failed to reset traffic');
    } finally {
      setResetLoading(false);
    }
  };

  // Client counts
  const onlineCount = clients.filter((c) => Boolean(c.isOnline)).length;
  const activeCount = clients.filter((c) => c.enable !== false).length;
  const disabledCount = clients.filter((c) => c.enable === false).length;

  // Filter clients
  const filteredClients = clients.filter((c) => {
    if (statusFilter === 'online' && !c.isOnline) return false;
    if (statusFilter === 'active' && c.enable === false) return false;
    if (statusFilter === 'disabled' && c.enable !== false) return false;

    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      (c.email && c.email.toLowerCase().includes(q)) ||
      (c.id && String(c.id).toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      {/* Toast alert */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl bg-slate-800 text-white border border-slate-700 shadow-2xl animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-medium">{toastMessage}</span>
        </div>
      )}

      {/* Breadcrumb Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/80 rounded-xl transition-all"
            title="Back to Inbounds"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">{server.nickname}</span>
              <span className="text-xs text-slate-600">/</span>
              <h2 className="text-xl font-bold text-white tracking-tight">{inbound.remark}</h2>
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 uppercase">
                {inbound.protocol} : {inbound.port}
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Inbound #{inbound.id} • Live Client Management
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Quick Bulk Activate / Deactivate controls */}
          {clients.length > 0 && (
            <div className="hidden sm:flex items-center gap-1.5 bg-slate-900/60 p-1 border border-slate-800 rounded-xl">
              <button
                type="button"
                onClick={() => setBulkAction('activate_all')}
                disabled={disabledCount === 0}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 rounded-lg transition-all disabled:opacity-40 disabled:hover:bg-transparent"
                title="Activate all disabled clients on this inbound"
              >
                <Power className="w-3.5 h-3.5" />
                <span>Enable All</span>
              </button>
              <span className="text-slate-700">|</span>
              <button
                type="button"
                onClick={() => setBulkAction('deactivate_all')}
                disabled={activeCount === 0}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 rounded-lg transition-all disabled:opacity-40 disabled:hover:bg-transparent"
                title="Deactivate all active clients on this inbound"
              >
                <PowerOff className="w-3.5 h-3.5" />
                <span>Disable All</span>
              </button>
            </div>
          )}

          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/80 rounded-xl transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Sync Clients</span>
          </button>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-lg shadow-indigo-600/30 transition-all"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Client</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            placeholder="Search clients by email, UUID, or identifier..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-900/60 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* Status filter tabs */}
        <div className="flex items-center gap-1 bg-slate-900/60 p-1 border border-slate-800 rounded-xl text-xs self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1 rounded-lg font-medium transition-all ${
              statusFilter === 'all'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            All ({clients.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('online')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-medium transition-all ${
              statusFilter === 'online'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-sm'
                : 'text-slate-400 hover:text-emerald-400 hover:bg-slate-800/60'
            }`}
            title="Filter by clients currently online & tunneling data"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span>Online ({onlineCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('active')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-medium transition-all ${
              statusFilter === 'active'
                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shadow-sm'
                : 'text-slate-400 hover:text-indigo-400 hover:bg-slate-800/60'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
            <span>Active ({activeCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('disabled')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-medium transition-all ${
              statusFilter === 'disabled'
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30 shadow-sm'
                : 'text-slate-400 hover:text-rose-400 hover:bg-slate-800/60'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
            <span>Disabled ({disabledCount})</span>
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-xs font-semibold">3x-ui Live Query Failure</h4>
            <p className="text-xs text-rose-300/90 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Clients Table */}
      {loading ? (
        <div className="py-20 text-center text-slate-500">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
          <p className="text-xs">Querying clients live from 3x-ui panel inbound...</p>
        </div>
      ) : filteredClients.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/30">
          <Users className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-white mb-1">No Clients Found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mb-4">
            {searchQuery
              ? `No clients match the query "${searchQuery}"`
              : statusFilter === 'disabled'
              ? 'There are no disabled clients on this inbound.'
              : statusFilter === 'active'
              ? 'There are no active clients on this inbound.'
              : 'There are currently no clients registered on this inbound.'}
          </p>
          {statusFilter !== 'all' ? (
            <button
              onClick={() => setStatusFilter('all')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-all"
            >
              <span>View All Clients</span>
            </button>
          ) : (
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-all"
            >
              <UserPlus className="w-4 h-4" />
              <span>Create First Client</span>
            </button>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-800/50 text-slate-400 border-b border-slate-800 uppercase tracking-wider font-semibold text-[10px]">
                <tr>
                  <th className="px-6 py-3.5">Client / Email</th>
                  <th className="px-4 py-3.5">UUID / Key</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5">Usage & Quota</th>
                  <th className="px-4 py-3.5">Expiration</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {filteredClients.map((client) => {
                  const usedBytes = (client.up || 0) + (client.down || 0);
                  const totalQuota = client.totalGB || 0;
                  const percentUsed =
                    totalQuota > 0 ? Math.min(100, Math.round((usedBytes / totalQuota) * 100)) : 0;
                  const expired = isExpired(client.expiryTime);

                  return (
                    <tr key={client.id} className="hover:bg-slate-800/30 transition-colors">
                      {/* Email / Remark */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2.5">
                          {/* Live Online / Offline Small Icon */}
                          {client.isOnline ? (
                            <span
                              className="relative flex h-2.5 w-2.5 shrink-0"
                              title="Client is ONLINE (actively tunneling data)"
                            >
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.9)]"></span>
                            </span>
                          ) : (
                            <span
                              className={`w-2.5 h-2.5 rounded-full shrink-0 border ${
                                client.enable === false
                                  ? 'bg-rose-500/20 border-rose-500/40'
                                  : 'bg-slate-600/70 border-slate-500/40'
                              }`}
                              title={client.enable === false ? 'Client is disabled' : 'Client is offline'}
                            />
                          )}

                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-white text-xs">{client.email}</span>
                            {client.isOnline && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 uppercase tracking-wider">
                                ONLINE
                              </span>
                            )}
                          </div>

                          <button
                            onClick={() => setQrModalClient(client)}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-md transition-all shrink-0 ml-auto sm:ml-0"
                            title="Show QR Code, V2Ray URI & Subscription Link"
                          >
                            <QrCode className="w-3 h-3" />
                            <span>QR / Links</span>
                          </button>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-500 font-mono">
                          {client.subId && <span>Sub: {client.subId}</span>}
                          {client.subId && client.lastOnline && <span>•</span>}
                          {client.lastOnline && (
                            <span className="text-slate-400">
                              Last online: {formatRelativeTime(client.lastOnline)}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* UUID / Key with copy button */}
                      <td className="px-4 py-4">
                        <div className="inline-flex items-center gap-1.5 font-mono text-[11px] text-slate-400 bg-slate-950/60 px-2 py-1 rounded-lg border border-slate-800">
                          <span title={client.id} className="cursor-default hover:text-slate-200 transition-colors">
                            {formatShortId(client.id)}
                          </span>
                          <button
                            onClick={() => handleCopyId(client.id)}
                            className="p-1 text-slate-500 hover:text-white rounded hover:bg-slate-800 transition-colors shrink-0"
                            title={`Copy full UUID (${client.id})`}
                          >
                            {copiedId === client.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Status with interactive 1-click toggle switch */}
                      <td className="px-4 py-4">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={client.enable !== false}
                          aria-label={`${client.enable !== false ? 'Deactivate' : 'Activate'} client ${client.email || client.id}`}
                          disabled={togglingClientId === client.id}
                          onClick={() => handleToggleEnable(client)}
                          className={`group inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all duration-200 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
                            client.enable !== false
                              ? 'bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/30 text-emerald-300'
                              : 'bg-slate-800/80 hover:bg-slate-800 border-slate-700 text-slate-400'
                          }`}
                          title={`Click to ${client.enable !== false ? 'Deactivate' : 'Activate'} this client`}
                        >
                          {togglingClientId === client.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                          ) : (
                            <span
                              className={`w-2 h-2 rounded-full transition-all ${
                                client.enable !== false
                                  ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]'
                                  : 'bg-slate-500'
                              }`}
                            />
                          )}
                          <span>{client.enable !== false ? 'Active' : 'Disabled'}</span>
                          <span
                            className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full p-0.5 transition-colors duration-200 ease-in-out ${
                              client.enable !== false ? 'bg-emerald-600' : 'bg-slate-700'
                            }`}
                          >
                            <span
                              className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform duration-200 ease-in-out shadow-sm ${
                                client.enable !== false ? 'translate-x-3' : 'translate-x-0'
                              }`}
                            />
                          </span>
                        </button>
                      </td>

                      {/* Usage & Bandwidth Quota */}
                      <td className="px-4 py-4 min-w-[180px]">
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span className="font-semibold text-slate-200">
                            {formatBytes(usedBytes)}
                          </span>
                          <span className="text-slate-500">
                            {totalQuota > 0 ? formatBytes(totalQuota) : 'Unlimited'}
                          </span>
                        </div>

                        {totalQuota > 0 ? (
                          <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                percentUsed > 90
                                  ? 'bg-rose-500'
                                  : percentUsed > 75
                                  ? 'bg-amber-500'
                                  : 'bg-indigo-500'
                              }`}
                              style={{ width: `${percentUsed}%` }}
                            ></div>
                          </div>
                        ) : (
                          <div className="text-[10px] text-emerald-400/80">No quota ceiling</div>
                        )}

                        <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-500">
                          <span>↑ {formatBytes(client.up)}</span>
                          <span>•</span>
                          <span>↓ {formatBytes(client.down)}</span>
                        </div>
                      </td>

                      {/* Expiration */}
                      <td className="px-4 py-4">
                        <div
                          className={`text-xs font-medium ${
                            expired ? 'text-rose-400 font-semibold' : 'text-slate-300'
                          }`}
                        >
                          {formatExpiry(client.expiryTime)}
                        </div>
                      </td>

                      {/* Inline Action Buttons */}
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* QR Code & Links button */}
                          <button
                            onClick={() => setQrModalClient(client)}
                            className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors"
                            title="View QR Code, V2Ray URI, and Subscription Link"
                          >
                            <QrCode className="w-4 h-4 text-emerald-400" />
                          </button>

                          {/* Edit button */}
                          <button
                            onClick={() => setEditingClient(client)}
                            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                            title="Edit expiry, bandwidth, or status"
                          >
                            <Edit2 className="w-4 h-4 text-indigo-400" />
                          </button>

                          {/* Reset Traffic button */}
                          <button
                            onClick={() => setClientToReset(client)}
                            className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors"
                            title="Reset client traffic counter"
                          >
                            <RotateCcw className="w-4 h-4 text-amber-400" />
                          </button>

                          {/* Delete button */}
                          <button
                            onClick={() => setClientToDelete(client)}
                            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                            title="Delete client from panel"
                          >
                            <Trash2 className="w-4 h-4 text-rose-400" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Client QR Code & Links Modal */}
      <ClientQrModal
        isOpen={!!qrModalClient}
        onClose={() => setQrModalClient(null)}
        client={qrModalClient}
        inbound={inbound}
        server={server}
      />

      {/* Edit Client Modal */}
      <EditClientModal
        isOpen={!!editingClient}
        onClose={() => setEditingClient(null)}
        serverId={server._id}
        client={editingClient}
        onClientUpdated={handleClientUpdated}
      />

      {/* Add Client Modal */}
      <AddClientModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        serverId={server._id}
        inboundId={inbound.id}
        onClientAdded={handleClientAdded}
      />

      {/* Confirm Delete Client Modal */}
      <ConfirmModal
        isOpen={!!clientToDelete}
        onClose={() => setClientToDelete(null)}
        onConfirm={handleDeleteClient}
        title="Delete VPN Client"
        message={`Are you sure you want to permanently delete client "${clientToDelete?.email || clientToDelete?.id}" from inbound #${inbound.id} on the 3x-ui panel? This cannot be undone.`}
        confirmText="Delete Client"
        danger={true}
        loading={deleteLoading}
      />

      {/* Confirm Reset Traffic Modal */}
      <ConfirmModal
        isOpen={!!clientToReset}
        onClose={() => setClientToReset(null)}
        onConfirm={handleResetTraffic}
        title="Reset Client Traffic"
        message={`Are you sure you want to reset upload and download counters to zero for "${clientToReset?.email || clientToReset?.id}" on the live panel?`}
        confirmText="Reset Traffic"
        danger={false}
        loading={resetLoading}
      />

      {/* Confirm Bulk Action Modal */}
      <ConfirmModal
        isOpen={!!bulkAction}
        onClose={() => setBulkAction(null)}
        onConfirm={() => handleBulkToggle(bulkAction === 'activate_all')}
        title={bulkAction === 'activate_all' ? 'Activate All Clients' : 'Deactivate All Clients'}
        message={
          bulkAction === 'activate_all'
            ? `Are you sure you want to activate all ${disabledCount} disabled client(s) on inbound #${inbound.id}? They will be permitted to connect to the VPN immediately.`
            : `Are you sure you want to deactivate all ${activeCount} active client(s) on inbound #${inbound.id}? This will immediately disconnect all active VPN connections on this inbound.`
        }
        confirmText={bulkAction === 'activate_all' ? 'Activate All' : 'Deactivate All'}
        danger={bulkAction === 'deactivate_all'}
        loading={bulkLoading}
      />
    </div>
  );
}
