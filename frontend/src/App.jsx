import React, { useState } from 'react';
import { useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import AuthPage from './pages/AuthPage';
import DashboardPage from './pages/DashboardPage';
import ServerDetailPage from './pages/ServerDetailPage';
import InboundClientsPage from './pages/InboundClientsPage';
import SecurityInfoView from './pages/SecurityInfoView';
import DocsView from './pages/DocsView';
import { Loader2 } from 'lucide-react';

export default function App() {
  const { isAuthenticated, loading } = useAuth();

  const [activeTab, setActiveTab] = useState('servers'); // 'servers' | 'security' | 'docs'
  const [selectedServer, setSelectedServer] = useState(null);
  const [selectedInbound, setSelectedInbound] = useState(null);

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

  // Handle sidebar navigation
  const handleNavChange = (tabId) => {
    setActiveTab(tabId);
    setSelectedServer(null);
    setSelectedInbound(null);
  };

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
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Navbar />

      <div className="flex-1 flex max-w-7xl w-full mx-auto">
        <Sidebar
          activeView={selectedServer || selectedInbound ? 'servers' : activeTab}
          onViewChange={handleNavChange}
        />

        <main className="flex-1 p-6 lg:p-8 min-w-0">
          {renderContent()}
        </main>
      </div>
    </div>
  );
}
