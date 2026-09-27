import React from 'react';
import { Terminal, Globe, Server, Check, ArrowRight, Shield } from 'lucide-react';

export default function DocsView() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-xl font-bold text-white tracking-tight">3x-ui Integration & API Reference</h2>
        <p className="text-xs text-slate-400">
          How PanelHub interfaces with standard MHSanaei / FranzKafkaYu 3x-ui panels.
        </p>
      </div>

      <div className="space-y-4">
        {/* Step 1 */}
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold">1</span>
            <h3 className="text-sm font-semibold text-white">Panel URL & Port</h3>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Ensure your 3x-ui panel is reachable via its public IP or domain name. Typically 3x-ui runs on port <code className="text-indigo-400 bg-slate-800 px-1 py-0.5 rounded">2053</code> or <code className="text-indigo-400 bg-slate-800 px-1 py-0.5 rounded">20530</code>.
          </p>
          <div className="p-3 bg-slate-950 rounded-xl font-mono text-xs text-slate-300">
            http://YOUR_SERVER_IP:2053 or https://your-domain.com:2053
          </div>
        </div>

        {/* Step 2 */}
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold">2</span>
            <h3 className="text-sm font-semibold text-white">Supported 3x-ui API Endpoints</h3>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            PanelHub interacts directly with standard 3x-ui endpoints:
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="text-slate-500 border-b border-slate-800 text-[11px]">
                <tr>
                  <th className="py-2">Action</th>
                  <th className="py-2">Method</th>
                  <th className="py-2">3x-ui Path</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                <tr>
                  <td className="py-2 text-slate-400">Authentication</td>
                  <td className="py-2 text-emerald-400">POST</td>
                  <td className="py-2">/login</td>
                </tr>
                <tr>
                  <td className="py-2 text-slate-400">List Inbounds</td>
                  <td className="py-2 text-indigo-400">GET</td>
                  <td className="py-2">/panel/api/inbounds/list</td>
                </tr>
                <tr>
                  <td className="py-2 text-slate-400">Update Client</td>
                  <td className="py-2 text-emerald-400">POST</td>
                  <td className="py-2">/panel/api/inbounds/updateClient/:clientId</td>
                </tr>
                <tr>
                  <td className="py-2 text-slate-400">Reset Client Traffic</td>
                  <td className="py-2 text-emerald-400">POST</td>
                  <td className="py-2">/panel/api/inbounds/:id/resetClientTraffic/:email</td>
                </tr>
                <tr>
                  <td className="py-2 text-slate-400">Delete Client</td>
                  <td className="py-2 text-emerald-400">POST</td>
                  <td className="py-2">/panel/api/inbounds/:id/delClient/:clientId</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Step 3 */}
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold">3</span>
            <h3 className="text-sm font-semibold text-white">SSL Certificates</h3>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            PanelHub natively supports self-signed SSL certificates and IP-based HTTPS connections. If your panel uses a custom root or self-signed cert, requests will still complete securely without certificate rejection.
          </p>
        </div>
      </div>
    </div>
  );
}
