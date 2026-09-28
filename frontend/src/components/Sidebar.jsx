import React from 'react';
import { Server, ShieldCheck, Cpu, HardDrive, Radio, Terminal, ExternalLink, PanelLeftClose } from 'lucide-react';

export default function Sidebar({ activeView, onViewChange, onClose, serverCount = 0 }) {
  const navItems = [
    { id: 'servers', label: 'Connected Panels', icon: Server, badge: serverCount },
    { id: 'security', label: 'Security & Encryption', icon: ShieldCheck },
    { id: 'docs', label: '3x-ui API Guide', icon: Terminal },
  ];

  return (
    <aside className="w-64 shrink-0 border-r border-slate-800 bg-slate-900/90 md:bg-slate-900/40 p-4 min-h-[calc(100vh-61px)] h-full overflow-y-auto">
      <div className="space-y-6">
        <div>
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-3 mb-2">
            <span>Navigation</span>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                title="Hide navigation panel (Ctrl+B)"
                aria-label="Hide navigation panel"
              >
                <PanelLeftClose className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onViewChange(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge !== undefined && (
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                        isActive ? 'bg-indigo-700 text-white' : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-800 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-indigo-400">
            <Radio className="w-3.5 h-3.5 animate-pulse text-indigo-400" />
            <span>AES-256-GCM Vault</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Panel credentials are encrypted using AES-256-GCM with your master key and decrypted only in-memory during 3x-ui API calls.
          </p>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-800 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
            <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
            <span>Zero Inbound Storage</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Inbounds and clients are never stored in MongoDB. All client metrics and proxies are queried live from your 3x-ui panels.
          </p>
        </div>
      </div>
    </aside>
  );
}
