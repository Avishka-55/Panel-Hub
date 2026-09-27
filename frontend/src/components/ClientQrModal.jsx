import React, { useState, useEffect } from 'react';
import {
  X,
  QrCode,
  Copy,
  Check,
  Globe,
  Link2
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { formatBytes, formatExpiry } from '../utils/formatters';

export default function ClientQrModal({ isOpen, onClose, client, inbound, server }) {
  if (!isOpen || !client) return null;

  const [activeTab, setActiveTab] = useState('v2ray'); // 'v2ray' | 'sub'
  const [copied, setCopied] = useState(false);
  const [copiedKey, setCopiedKey] = useState(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const v2rayLink = client.link || '';
  const subUrl = client.subUrl || '';
  const activeLink = activeTab === 'v2ray' ? v2rayLink : subUrl;

  const handleCopy = (text, key = 'main') => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    if (key === 'main') {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    }
  };

  const stream = client.streamSettings || {};
  const network = stream.network || 'tcp';
  const security = stream.security || (inbound?.protocol === 'trojan' ? 'tls' : 'none');

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-sm animate-fadeIn"
    >
      <div className="relative w-full max-w-md max-h-[92vh] flex flex-col bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden animate-scaleUp">
        {/* Sticky Header with Prominent Close Button */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-900/95 shrink-0 z-10">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
              <QrCode className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm font-semibold text-white truncate">QR & Connection Links</h3>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 uppercase shrink-0">
                  {inbound?.protocol || client.protocol || 'VPN'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono truncate">
                {client.email || client.id}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700/80 rounded-xl transition-all shadow-sm shrink-0 ml-3"
            title="Close modal (Esc)"
          >
            <span>Close</span>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Scrollable Modal Body */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
          {/* Tab Selector */}
          <div className="flex p-1 bg-slate-950/80 border border-slate-800 rounded-xl">
            <button
              onClick={() => setActiveTab('v2ray')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'v2ray'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>V2Ray / Node URI</span>
            </button>

            <button
              onClick={() => setActiveTab('sub')}
              disabled={!subUrl}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'sub'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : subUrl
                  ? 'text-slate-400 hover:text-white'
                  : 'text-slate-600 cursor-not-allowed'
              }`}
            >
              <Link2 className="w-3.5 h-3.5" />
              <span>Subscription URL</span>
              {!subUrl && <span className="text-[10px] opacity-60">(N/A)</span>}
            </button>
          </div>

          {/* Compact QR Code Container */}
          <div className="flex flex-col items-center justify-center py-4 px-3 bg-slate-950/60 border border-slate-800/80 rounded-2xl">
            {activeLink ? (
              <div className="p-2.5 bg-white rounded-xl shadow-lg border border-slate-200">
                <QRCodeSVG
                  value={activeLink}
                  size={150}
                  level="M"
                  includeMargin={false}
                  bgColor="#ffffff"
                  fgColor="#0f172a"
                />
              </div>
            ) : (
              <div className="py-8 text-center text-slate-500 text-xs">
                No link available for this client.
              </div>
            )}

            <p className="text-[11px] text-slate-400 text-center mt-2.5">
              Scan with <strong className="text-slate-300">v2rayNG, Shadowrocket, Streisand, Clash, v2rayN</strong>
            </p>
          </div>

          {/* Link Display & Copy Bar */}
          <div>
            <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1 font-medium">
              <span>{activeTab === 'v2ray' ? 'Direct Configuration Link' : 'Subscription Endpoint'}</span>
              <span className="text-[10px] text-slate-500">Click Copy to import</span>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={activeLink || 'No link generated'}
                className="flex-1 px-3 py-2 bg-slate-950/90 border border-slate-800 rounded-xl text-xs text-slate-300 font-mono focus:outline-none select-all"
              />
              <button
                onClick={() => handleCopy(activeLink, 'main')}
                disabled={!activeLink}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-xl transition-all shadow-md shadow-indigo-600/20 shrink-0"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-300" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Connection Parameters Grid */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 bg-slate-800/40 border border-slate-800/60 rounded-xl">
              <span className="text-[9px] text-slate-500 block uppercase font-bold tracking-wider">
                Network & Security
              </span>
              <div className="text-slate-200 font-medium capitalize mt-0.5 text-xs truncate">
                {network} • {security}
              </div>
            </div>

            <div className="p-2.5 bg-slate-800/40 border border-slate-800/60 rounded-xl">
              <span className="text-[9px] text-slate-500 block uppercase font-bold tracking-wider">
                Host : Port
              </span>
              <div className="text-slate-200 font-medium font-mono mt-0.5 text-xs truncate" title={`${client.host || 'server'}:${client.port || inbound?.port}`}>
                {client.host || 'server'}:{client.port || inbound?.port}
              </div>
            </div>

            <div className="p-2.5 bg-slate-800/40 border border-slate-800/60 rounded-xl">
              <span className="text-[9px] text-slate-500 block uppercase font-bold tracking-wider">
                Quota
              </span>
              <div className="text-slate-200 font-medium mt-0.5 text-xs">
                {client.totalGB > 0 ? formatBytes(client.totalGB) : 'Unlimited'}
              </div>
            </div>

            <div className="p-2.5 bg-slate-800/40 border border-slate-800/60 rounded-xl">
              <span className="text-[9px] text-slate-500 block uppercase font-bold tracking-wider">
                Expiration
              </span>
              <div className="text-slate-200 font-medium mt-0.5 text-xs truncate">
                {formatExpiry(client.expiryTime)}
              </div>
            </div>
          </div>

          {/* Quick Copy UUID / SubID */}
          <div className="flex items-center justify-between p-2.5 bg-slate-950/60 border border-slate-800/80 rounded-xl text-xs">
            <div className="flex flex-col overflow-hidden mr-2">
              <span className="text-[9px] text-slate-500 uppercase font-bold">UUID / Key</span>
              <span className="text-slate-300 font-mono truncate text-[11px]">{client.id}</span>
            </div>
            <button
              onClick={() => handleCopy(client.id, 'uuid')}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors shrink-0"
              title="Copy UUID / Password"
            >
              {copiedKey === 'uuid' ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>

        {/* Sticky Footer */}
        <div className="px-5 py-2.5 bg-slate-950/90 border-t border-slate-800 flex items-center justify-between shrink-0">
          <span className="text-[10px] text-slate-500">Press Esc or click outside to dismiss</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-all shadow-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
