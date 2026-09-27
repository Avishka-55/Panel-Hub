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
  Users
} from 'lucide-react';
import { serversApi } from '../api/client';
import { formatBytes, formatExpiry, isExpired } from '../utils/formatters';
import EditClientModal from '../components/EditClientModal';
import AddClientModal from '../components/AddClientModal';
import ConfirmModal from '../components/ConfirmModal';

export default function InboundClientsPage({ server, inbound, onBack }) {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [editingClient, setEditingClient] = useState(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const [clientToDelete, setClientToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [clientToReset, setClientToReset] = useState(null);
  const [resetLoading, setResetLoading] = useState(false);

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

  // Client Update Handler
  const handleClientUpdated = (updatedClient) => {
    setClients((prev) =>
      prev.map((c) => (c.id === updatedClient.id ? { ...c, ...updatedClient } : c))
    );
    showToast(`Client "${updatedClient.email || updatedClient.id}" updated successfully`);
  };

  // Client Add Handler
  const handleClientAdded = (newClient) => {
    setClients((prev) => [newClient, ...prev]);
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

  // Filter clients
  const filteredClients = clients.filter((c) => {
    const q = searchQuery.toLowerCase();
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
      <div className="flex items-center justify-between gap-4">
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

        <div className="text-xs text-slate-400 font-medium">
          Showing <span className="text-white font-bold">{filteredClients.length}</span> clients
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
              : 'There are currently no clients registered on this inbound.'}
          </p>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-all"
          >
            <UserPlus className="w-4 h-4" />
            <span>Create First Client</span>
          </button>
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
                        <div className="font-semibold text-white text-xs">{client.email}</div>
                        {client.subId && (
                          <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                            Sub: {client.subId}
                          </div>
                        )}
                      </td>

                      {/* UUID / Key with copy button */}
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-400 bg-slate-950/60 px-2.5 py-1 rounded-lg border border-slate-800 max-w-xs">
                          <span className="truncate">{client.id}</span>
                          <button
                            onClick={() => handleCopyId(client.id)}
                            className="p-1 text-slate-500 hover:text-white rounded hover:bg-slate-800 transition-colors shrink-0"
                            title="Copy UUID / Key"
                          >
                            {copiedId === client.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-4">
                        {client.enable ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                            Disabled
                          </span>
                        )}
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
    </div>
  );
}
