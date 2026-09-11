// ============================================================================
// PERSONAL OS — Main App Shell
// Routes between views, manages sidebar state, and orchestrates navigation.
// ============================================================================

import { useState, useEffect } from 'react';
import { Menu } from 'lucide-react';
import { Sidebar, MobileNav } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { FocusTimer } from './components/FocusTimer';
import { QuickCapture } from './components/QuickCapture';
import { NorthStarView } from './components/NorthStar';
import { GoalsView } from './components/goals/GoalsView';
import { TimeView } from './components/time/TimeView';
import { PillarView } from './components/PillarView';
import { JobHuntDashboard } from './components/job-hunt/JobHuntDashboard';
import { AgencyDashboard } from './components/agency/AgencyDashboard';
import { SaasDashboard } from './components/saas/SaasDashboard';
import { ForexDashboard } from './components/forex/ForexDashboard';
import { FitnessDashboard } from './components/fitness/FitnessDashboard';
import { VoireDashboard } from './components/voire/VoireDashboard';
import { AskAI } from './components/AskAI';
import { InsightsView } from './components/insights/InsightsView';
import { ToastContainer } from './components/Toast';
import { useActiveTimer } from './hooks/useDatabase';
import { initDB } from './services/db';
import { PILLAR_MAP } from './config/pillars';
import { formatDuration } from './utils/helpers';
import type { ViewId } from './components/Sidebar';
import type { PillarSlug } from './types';

function App() {
  const [currentView, setCurrentView] = useState<ViewId>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dbReady, setDbReady] = useState(false);
  const { session, elapsed } = useActiveTimer();

  // Initialize IndexedDB
  useEffect(() => {
    initDB().then(() => setDbReady(true));
  }, []);

  const handleNavigate = (view: ViewId) => {
    setCurrentView(view);
    window.scrollTo(0, 0);
  };

  // Page titles
  const getPageTitle = (): string => {
    switch (currentView) {
      case 'dashboard': return 'Command Center';
      case 'insights': return 'Insights & Integrity';
      case 'time': return 'Time & Intelligence';
      case 'timer': return 'Focus Timer';
      case 'quick-capture': return 'Quick Capture';
      case 'north-star': return 'North Star Report';
      case 'goals': return 'Goals & KPI Reality';
      case 'ask-ai': return 'Ask My OS';
      default: {
        const p = PILLAR_MAP[currentView];
        return p?.title || 'Personal OS';
      }
    }
  };

  // Check if view is a pillar
  const isPillarView = (view: ViewId): view is PillarSlug => {
    return view in PILLAR_MAP;
  };

  // Render main content
  const renderContent = () => {
    if (!dbReady) {
      return (
        <div className="page-body">
          <div className="empty-state">
            <div style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              border: '3px solid var(--border-subtle)',
              borderTopColor: '#6366f1',
              animation: 'spin 0.8s linear infinite',
              marginBottom: 16,
            }} />
            <div className="empty-state-title">Initializing Personal OS</div>
            <div className="empty-state-text">Setting up your local database...</div>
          </div>
        </div>
      );
    }

    switch (currentView) {
      case 'dashboard':
        return <Dashboard onNavigate={handleNavigate} />;
      case 'insights':
        return <InsightsView onNavigate={handleNavigate} />;
      case 'time':
        return <TimeView />;
      case 'timer':
        return <FocusTimer />;
      case 'quick-capture':
        return <QuickCapture />;
      case 'north-star':
        return <NorthStarView />;
      case 'goals':
        return <GoalsView />;
      case 'ask-ai':
        return <AskAI />;
      default:
        if (currentView === 'job_hunt') {
          return <JobHuntDashboard onNavigate={handleNavigate} />;
        }
        if (currentView === 'agency') {
          return <AgencyDashboard onNavigate={handleNavigate} />;
        }
        if (currentView === 'trading_os') {
          return <SaasDashboard onNavigate={handleNavigate} />;
        }
        if (currentView === 'forex') {
          return <ForexDashboard onNavigate={handleNavigate} />;
        }
        if (currentView === 'fitness') {
          return <FitnessDashboard onNavigate={handleNavigate} />;
        }
        if (currentView === 'voire') {
          return <VoireDashboard onNavigate={handleNavigate} />;
        }
        if (isPillarView(currentView)) {
          return <PillarView pillarId={currentView} onNavigate={handleNavigate} />;
        }
        return <Dashboard onNavigate={handleNavigate} />;
    }
  };

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <Sidebar
        currentView={currentView}
        onNavigate={handleNavigate}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
      />

      {/* Main Content */}
      <main className="main-content">
        {/* Header */}
        <header className="page-header">
          <div className="page-header-left">
            <button
              className="btn-icon menu-toggle"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              <Menu size={18} />
            </button>
            <h1 className="page-header-title">{getPageTitle()}</h1>
          </div>

          <div className="page-header-right">
            {/* Active Timer Indicator */}
            {session && (session.status === 'RUNNING' || session.status === 'PAUSED') && (
              <button
                className="btn btn-sm"
                style={{
                  background: `${PILLAR_MAP[session.pillarId]?.color || '#6366f1'}15`,
                  color: PILLAR_MAP[session.pillarId]?.color || '#6366f1',
                  border: `1px solid ${PILLAR_MAP[session.pillarId]?.color || '#6366f1'}30`,
                  fontFamily: 'var(--font-mono)',
                  gap: 6,
                }}
                onClick={() => handleNavigate('timer')}
              >
                <span style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: session.status === 'RUNNING' ? '#ef4444' : '#f59e0b',
                  animation: session.status === 'RUNNING' ? 'pulse 1.5s infinite' : 'none',
                  display: 'inline-block',
                }} />
                {formatDuration(elapsed)}
                <span style={{
                  fontSize: 'var(--text-xs)',
                  opacity: 0.7,
                  fontFamily: 'var(--font-sans)',
                }}>
                  {session.category}
                </span>
              </button>
            )}
          </div>
        </header>

        {renderContent()}
      </main>

      {/* Mobile Nav */}
      <MobileNav
        currentView={currentView}
        onNavigate={handleNavigate}
        onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
      />

      {/* Toasts */}
      <ToastContainer />
    </div>
  );
}

export default App;
