// ============================================================================
// PERSONAL OS — Sidebar Navigation
// ============================================================================

import {
  Briefcase, Building2, LineChart, TrendingUp,
  Heart, Palette, LayoutDashboard, Timer,
  Target, Zap, MessageSquare, Star, Clock,
  ChevronLeft, Menu, Compass, RotateCcw,
} from 'lucide-react';
import { PILLARS } from '../config/pillars';
import type { PillarSlug } from '../types';

const ICON_MAP: Record<string, React.FC<{ size?: number }>> = {
  Briefcase, Building2, LineChart, TrendingUp, Heart, Palette,
};

export type ViewId =
  | 'dashboard'
  | 'insights'
  | 'timer'
  | 'time'
  | 'quick-capture'
  | 'north-star'
  | 'goals'
  | 'ask-ai'
  | PillarSlug;

interface SidebarProps {
  currentView: ViewId;
  onNavigate: (view: ViewId) => void;
  isOpen: boolean;
  onToggle: () => void;
}

export function Sidebar({ currentView, onNavigate, isOpen, onToggle }: SidebarProps) {
  const navItem = (id: ViewId, label: string, icon: React.ReactNode, color?: string) => (
    <button
      key={id}
      className={`sidebar-item ${currentView === id ? 'active' : ''}`}
      style={{ '--item-color': color } as React.CSSProperties}
      onClick={() => { onNavigate(id); if (window.innerWidth <= 768) onToggle(); }}
    >
      <span className="sidebar-item-icon">{icon}</span>
      <span className="truncate">{label}</span>
    </button>
  );

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && window.innerWidth <= 768 && (
        <div
          className="modal-backdrop"
          style={{ zIndex: 99 }}
          onClick={onToggle}
        />
      )}

      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <Star size={18} />
          </div>
          <div>
            <div className="sidebar-title">Personal OS</div>
            <div className="sidebar-subtitle">Command Center</div>
          </div>
          <button
            className="btn-icon"
            onClick={onToggle}
            style={{ marginLeft: 'auto' }}
          >
            <ChevronLeft size={16} />
          </button>
        </div>

        <nav className="sidebar-nav">
          <div className="sidebar-section-label">Overview</div>
          {navItem('dashboard', 'Dashboard', <LayoutDashboard size={18} />)}
          {navItem('insights', 'Insights & Alerts', <Compass size={18} />, '#ec4899')}
          {navItem('time', 'Time & Intelligence', <Clock size={18} />, '#06b6d4')}
          {navItem('timer', 'Focus Timer', <Timer size={18} />, '#6366f1')}
          {navItem('quick-capture', 'Quick Capture', <Zap size={18} />, '#22c55e')}
          {navItem('north-star', 'North Star', <Star size={18} />, '#fbbf24')}
          {navItem('goals', 'Goals & KPIs', <Target size={18} />, '#8b5cf6')}

          <div className="sidebar-section-label" style={{ marginTop: 8 }}>Pillars</div>
          {PILLARS.map((pillar) => {
            const IconComp = ICON_MAP[pillar.icon];
            return navItem(
              pillar.id,
              pillar.title,
              IconComp ? (
                <IconComp size={18} />
              ) : (
                <span className="sidebar-item-dot" style={{ background: pillar.color }} />
              ),
              pillar.color
            );
          })}

          <div className="sidebar-section-label" style={{ marginTop: 8 }}>AI</div>
          {navItem('ask-ai', 'Ask My OS', <MessageSquare size={18} />, '#8b5cf6')}
        </nav>

        <div className="sidebar-footer" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <button
            className={`btn btn-ghost btn-sm w-full ${currentView === 'goals' ? 'active' : ''}`}
            style={{ justifyContent: 'flex-start', gap: 8 }}
            onClick={() => { onNavigate('goals'); if (window.innerWidth <= 768) onToggle(); }}
          >
            <Target size={14} />
            <span>Goals & KPIs</span>
          </button>
          <button
            className="btn btn-ghost btn-sm w-full"
            style={{ justifyContent: 'flex-start', gap: 8, color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}
            onClick={async () => {
              if (window.confirm('Reset all Personal OS data? This will clear all test/dummy records across all pillars and stores so you can start fresh for your 7-day live test.')) {
                if (typeof (window as any).resetPersonalOS === 'function') {
                  await (window as any).resetPersonalOS();
                }
              }
            }}
            title="Wipe test data and start fresh"
          >
            <RotateCcw size={13} />
            <span>Fresh Start (Reset OS)</span>
          </button>
        </div>
      </aside>
    </>
  );
}

// Mobile Bottom Navigation
export function MobileNav({
  currentView,
  onNavigate,
  onMenuToggle,
}: {
  currentView: ViewId;
  onNavigate: (view: ViewId) => void;
  onMenuToggle: () => void;
}) {
  const items: { id: ViewId; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: 'Home', icon: <LayoutDashboard size={20} /> },
    { id: 'timer', label: 'Timer', icon: <Timer size={20} /> },
    { id: 'quick-capture', label: 'Capture', icon: <Zap size={20} /> },
    { id: 'north-star', label: 'North Star', icon: <Star size={20} /> },
  ];

  return (
    <div className="mobile-nav">
      <div className="mobile-nav-inner">
        {items.map((item) => (
          <button
            key={item.id}
            className={`mobile-nav-item ${currentView === item.id ? 'active' : ''}`}
            onClick={() => onNavigate(item.id)}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
        <button className="mobile-nav-item" onClick={onMenuToggle}>
          <Menu size={20} />
          <span>More</span>
        </button>
      </div>
    </div>
  );
}
