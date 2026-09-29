import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Server, LogOut, PanelLeftClose, PanelLeftOpen, Menu, X, UserCog } from 'lucide-react';

export default function Navbar({
  isMobileMenuOpen = false,
  onToggleMobileMenu,
  isDesktopSidebarVisible = true,
  onToggleDesktopSidebar,
  activeView,
  onViewChange,
  serverCount = 0
}) {
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md px-4 sm:px-6 py-3 sm:py-3.5 transition-all">
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center gap-2.5 sm:gap-3">
          {/* Mobile Menu Hamburger / Close Toggle */}
          {user && onToggleMobileMenu && (
            <button
              type="button"
              onClick={onToggleMobileMenu}
              className="p-2 rounded-xl text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/80 md:hidden transition-all focus:outline-none focus:ring-1 focus:ring-indigo-500"
              aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
            >
              {isMobileMenuOpen ? (
                <X className="w-4 h-4 text-white" />
              ) : (
                <Menu className="w-4 h-4 text-indigo-400" />
              )}
            </button>
          )}

          {/* Desktop Sidebar Toggle Button */}
          {user && onToggleDesktopSidebar && (
            <button
              type="button"
              onClick={onToggleDesktopSidebar}
              className="hidden md:flex p-2 rounded-xl text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/80 transition-all focus:outline-none focus:ring-1 focus:ring-indigo-500"
              title={isDesktopSidebarVisible ? 'Hide sidebar (Ctrl+B)' : 'Show sidebar (Ctrl+B)'}
              aria-label={isDesktopSidebarVisible ? 'Hide sidebar' : 'Show sidebar'}
            >
              {isDesktopSidebarVisible ? (
                <PanelLeftClose className="w-4 h-4" />
              ) : (
                <PanelLeftOpen className="w-4 h-4 text-indigo-400" />
              )}
            </button>
          )}

          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 shrink-0">
            <Server className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-base sm:text-lg text-white tracking-tight">PanelHub</span>
              <span className="hidden sm:inline-flex text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                SaaS Admin
              </span>
            </div>
            <p className="hidden sm:block text-xs text-slate-400">Multi-Tenant 3x-ui Panel Orchestrator</p>
          </div>
        </div>

        {/* Quick nav links on desktop when sidebar is collapsed */}
        {user && !isDesktopSidebarVisible && onViewChange && (
          <nav className="hidden md:flex items-center gap-1 bg-slate-800/60 p-1 border border-slate-700/60 rounded-xl text-xs animate-fadeIn">
            <button
              onClick={() => onViewChange('servers')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
                activeView === 'servers'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <span>Connected Panels</span>
              {serverCount > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    activeView === 'servers'
                      ? 'bg-indigo-700 text-white'
                      : 'bg-slate-700 text-slate-300'
                  }`}
                >
                  {serverCount}
                </span>
              )}
            </button>
            <button
              onClick={() => onViewChange('security')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                activeView === 'security'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              Security & Encryption
            </button>
            <button
              onClick={() => onViewChange('docs')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                activeView === 'docs'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              3x-ui API Guide
            </button>
            <button
              onClick={() => onViewChange('account')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                activeView === 'account'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              Account
            </button>
          </nav>
        )}

        {/* User Info & Logout Button */}
        {user && (
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => onViewChange?.('account')}
              className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs transition-all ${
                activeView === 'account'
                  ? 'bg-indigo-600/20 border-indigo-500/40 text-white'
                  : 'bg-slate-800/80 hover:bg-slate-700/80 border-slate-700/60 text-slate-300'
              }`}
              title="Account & Security Settings"
            >
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-slate-400">Tenant:</span>
              <span className="font-medium text-slate-200">{user.email}</span>
              <UserCog className="w-3.5 h-3.5 text-indigo-400 ml-0.5" />
            </button>

            {/* Mobile Account button */}
            <button
              onClick={() => onViewChange?.('account')}
              className={`sm:hidden p-2 rounded-xl border transition-all ${
                activeView === 'account'
                  ? 'bg-indigo-600/30 border-indigo-500/50 text-indigo-300'
                  : 'bg-slate-800/80 hover:bg-slate-700/80 border-slate-700/80 text-slate-300'
              }`}
              title="Account Settings"
              aria-label="Account Settings"
            >
              <UserCog className="w-4 h-4 text-indigo-400" />
            </button>

            <button
              onClick={logout}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800/60 hover:bg-rose-500/20 hover:border-rose-500/40 border border-slate-700/80 rounded-xl transition-all"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5 text-rose-400 sm:text-slate-300" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
