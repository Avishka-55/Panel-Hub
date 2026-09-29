import React from 'react';
import { Server, ShieldCheck, Cpu, HardDrive, Radio, Terminal, ExternalLink, PanelLeftClose, UserCog } from 'lucide-react';

export default function Sidebar({ activeView, onViewChange, onClose, serverCount = 0 }) {
  const navItems = [
    { id: 'servers', label: 'Connected Panels', icon: Server, badge: serverCount },
    { id: 'security', label: 'Security & Encryption', icon: ShieldCheck },
    { id: 'docs', label: '3x-ui API Guide', icon: Terminal },
    { id: 'account', label: 'Account & Security', icon: UserCog },
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

        <div className="pt-2 border-t border-slate-800/80">
          <div className="p-3 rounded-xl bg-slate-800/30 border border-slate-800/60 flex items-center gap-2.5">
            <Radio className="w-3.5 h-3.5 text-indigo-400 shrink-0 animate-pulse" />
            <div className="min-w-0">
              <div className="text-[11px] font-semibold text-slate-300">AES-256-GCM Vault</div>
              <div className="text-[10px] text-slate-500 truncate">Encrypted In-Memory</div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
