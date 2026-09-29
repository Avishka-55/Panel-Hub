import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import MobileDrawer from './components/MobileDrawer';
import AuthPage from './pages/AuthPage';
import DashboardPage from './pages/DashboardPage';
import ServerDetailPage from './pages/ServerDetailPage';
import InboundClientsPage from './pages/InboundClientsPage';
import SecurityInfoView from './pages/SecurityInfoView';
import DocsView from './pages/DocsView';
import { Loader2 } from 'lucide-react';
import { serversApi } from './api/client';

export default function App() {
  const { isAuthenticated, loading, user, logout } = useAuth();

  const [activeTab, setActiveTab] = useState('servers'); // 'servers' | 'security' | 'docs'
  const [selectedServer, setSelectedServer] = useState(null);
  const [selectedInbound, setSelectedInbound] = useState(null);
  const [serverCount, setServerCount] = useState(0);

  // Mobile drawer: ALWAYS starts closed so it never blocks the screen on mobile load
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Desktop sidebar: persistent visibility state for desktop screens
  const [isDesktopSidebarVisible, setIsDesktopSidebarVisible] = useState(() => {
    const saved = localStorage.getItem('panelhub_sidebar_visible');
    return saved !== null ? saved === 'true' : true;
  });

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen((prev) => !prev);
  };

  const toggleDesktopSidebar = () => {
    setIsDesktopSidebarVisible((prev) => {
      const next = !prev;
      localStorage.setItem('panelhub_sidebar_visible', String(next));
      return next;
    });
  };

  // Sync server count on initial login / authentication
  useEffect(() => {
    if (isAuthenticated) {
      serversApi.list().then((res) => {
        if (res && res.success && Array.isArray(res.servers)) {
          setServerCount(res.servers.length);
        }
      }).catch(() => {});
    }
  }, [isAuthenticated]);

  // Keyboard shortcut Ctrl+B / Cmd+B to toggle sidebar on desktop
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggleDesktopSidebar();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthPage />;
  }

  // Handle navigation change
  const handleNavChange = (tabId) => {
    setActiveTab(tabId);
    setSelectedServer(null);
    setSelectedInbound(null);
    setIsMobileMenuOpen(false); // Ensure mobile drawer closes upon navigation
  };

  // Current view identifier for navbar & sidebar
  const currentView = selectedServer || selectedInbound ? 'servers' : activeTab;

  // Render view router
  const renderContent = () => {
    if (selectedServer && selectedInbound) {
      return (
        <InboundClientsPage
          server={selectedServer}
          inbound={selectedInbound}
          onBack={() => setSelectedInbound(null)}
        />
      );
    }

    if (selectedServer) {
      return (
        <ServerDetailPage
          server={selectedServer}
          onBack={() => setSelectedServer(null)}
          onSelectInbound={(inbound) => setSelectedInbound(inbound)}
        />
      );
    }

    switch (activeTab) {
      case 'security':
        return <SecurityInfoView />;
      case 'docs':
        return <DocsView />;
      case 'servers':
      default:
        return (
          <DashboardPage
            onSelectServer={(server) => {
              setSelectedServer(server);
              setSelectedInbound(null);
            }}
            onServerCountChange={setServerCount}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Navbar
        isMobileMenuOpen={isMobileMenuOpen}
        onToggleMobileMenu={toggleMobileMenu}
        isDesktopSidebarVisible={isDesktopSidebarVisible}
        onToggleDesktopSidebar={toggleDesktopSidebar}
        activeView={currentView}
        onViewChange={handleNavChange}
        serverCount={serverCount}
      />

      {/* Modern Compact Mobile Drawer (Sliding sheet, only 3 items, never full screen) */}
      <MobileDrawer
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        activeView={currentView}
        onViewChange={handleNavChange}
        serverCount={serverCount}
        user={user}
        onLogout={logout}
      />

      <div className="flex-1 flex max-w-7xl w-full mx-auto relative">
        {/* Desktop Sidebar (hidden on mobile, cleanly integrated in layout) */}
        {isDesktopSidebarVisible && (
          <div className="hidden md:block">
            <Sidebar
              activeView={currentView}
              serverCount={serverCount}
              onViewChange={handleNavChange}
              onClose={toggleDesktopSidebar}
            />
          </div>
        )}

        <main className="flex-1 p-4 sm:p-6 lg:p-8 min-w-0 transition-all">
          {renderContent()}
        </main>
      </div>
    </div>
  );
}
