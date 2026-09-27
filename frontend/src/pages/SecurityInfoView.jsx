import React from 'react';
import { ShieldCheck, Key, Lock, Database, EyeOff, Server, CheckCircle2 } from 'lucide-react';

export default function SecurityInfoView() {
  const securityPillars = [
    {
      icon: Lock,
      title: 'AES-256-GCM Encryption',
      desc: 'All 3x-ui panel passwords are encrypted using authenticated Galois/Counter Mode (GCM) with a dedicated 96-bit initialization vector (IV) and 128-bit authentication tag before being stored in MongoDB.',
      badge: 'NIST Compliant'
    },
    {
      icon: EyeOff,
      title: 'In-Memory Decryption Only',
      desc: 'Panel credentials are NEVER returned in API responses and NEVER logged. Decryption happens strictly in-memory within function scope right before dispatching HTTP calls to the downstream 3x-ui panel.',
      badge: 'Zero Plaintext Leaks'
    },
    {
      icon: Database,
      title: 'Zero DB Persistence for Clients',
      desc: 'No Inbound or Client collections exist in MongoDB. All client lists, traffic metrics, and expiration statuses are fetched live from the 3x-ui API on-demand, guaranteeing that your platform never holds stale or sensitive VPN client databases.',
      badge: 'Live Proxy Engine'
    },
    {
      icon: ShieldCheck,
      title: 'Strict Multi-Tenant Isolation',
      desc: 'Every server and client endpoint explicitly validates that the authenticated JWT owner matches the server record (ownerId === req.user._id). Cross-tenant access is rejected at the database query level.',
      badge: 'Tenant Isolated'
    },
    {
      icon: Key,
      title: 'Master Key Security',
      desc: 'The master key is supplied exclusively through the environment variable process.env.MASTER_KEY. It is never committed, hardcoded, or exposed in client bundles.',
      badge: 'Env Vaulted'
    },
    {
      icon: Server,
      title: 'Intelligent Rate Limiting',
      desc: 'Brute-force protection on authentication endpoints (30 req/15min) and downstream proxy protection (120 req/min) to prevent overwhelming your VPS nodes.',
      badge: 'Rate Limited'
    }
  ];

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            Security Architecture
          </span>
        </div>
        <h2 className="text-xl font-bold text-white tracking-tight">Enterprise-Grade Security Architecture</h2>
        <p className="text-xs text-slate-400">
          How PanelHub enforces cryptographic security, zero-storage sync, and multi-tenant boundary checks.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {securityPillars.map((pillar, idx) => {
          const Icon = pillar.icon;
          return (
            <div
              key={idx}
              className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                    {pillar.badge}
                  </span>
                </div>
                <h3 className="text-sm font-bold text-white mb-1.5">{pillar.title}</h3>
                <p className="text-xs text-slate-400 leading-relaxed">{pillar.desc}</p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center gap-1.5 text-[11px] text-emerald-400 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Enforced by Backend Core</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
