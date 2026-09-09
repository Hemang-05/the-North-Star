// ============================================================================
// PERSONAL OS — PILLAR CONFIGURATION
// Central registry for all six pillars with metadata, priority, and UI config.
// ============================================================================

import type { Pillar } from '../types';

export const PILLARS: Pillar[] = [
  {
    id: 'job_hunt',
    title: 'Job Hunt',
    icon: 'Briefcase',
    color: '#6366f1', // indigo
    priorityRank: 1,
    activeDays: [], // all days
    isActive: true,
  },
  {
    id: 'agency',
    title: 'Freelance → Agency',
    icon: 'Building2',
    color: '#8b5cf6', // violet
    priorityRank: 2,
    activeDays: [],
    isActive: true,
  },
  {
    id: 'trading_os',
    title: 'Trading OS',
    icon: 'LineChart',
    color: '#06b6d4', // cyan
    priorityRank: 3,
    activeDays: [],
    isActive: true,
  },
  {
    id: 'forex',
    title: 'Forex Learning',
    icon: 'TrendingUp',
    color: '#f59e0b', // amber
    priorityRank: 4,
    activeDays: [],
    isActive: true,
  },
  {
    id: 'fitness',
    title: 'Fitness & Health',
    icon: 'Heart',
    color: '#ef4444', // red
    priorityRank: 5,
    activeDays: [],
    isActive: true,
  },
  {
    id: 'voire',
    title: 'VOIRE',
    icon: 'Palette',
    color: '#ec4899', // pink
    priorityRank: 6,
    activeDays: [0, 6], // weekend-focused (Sun, Sat)
    isActive: true,
  },
];

export const PILLAR_MAP = Object.fromEntries(
  PILLARS.map((p) => [p.id, p])
) as Record<string, Pillar>;

// Focus Timer categories per pillar
export const FOCUS_CATEGORIES: Record<string, { label: string; subcategories: string[] }[]> = {
  job_hunt: [
    { label: 'Applications', subcategories: ['Applying', 'Resume Tailoring', 'Cover Letters'] },
    { label: 'Outreach', subcategories: ['Founder DMs', 'Recruiter Emails', 'Referrals', 'Follow-ups'] },
    { label: 'Interview Prep', subcategories: ['DSA', 'System Design', 'Behavioral', 'Mock Interviews'] },
    { label: 'Job Research', subcategories: ['Company Sourcing', 'Role Evaluation', 'Salary Research', 'Market Scanning'] },
    { label: 'Portfolio', subcategories: ['Project Work', 'GitHub', 'Technical Writing', 'LinkedIn'] },
    { label: 'Learning', subcategories: ['System Design', 'Architecture Patterns', 'Tech Stack Upgrades'] },
  ],
  agency: [
    { label: 'Client Work', subcategories: ['Development', 'Design', 'Meetings', 'Communication'] },
    { label: 'Lead Generation', subcategories: ['Research', 'Content', 'Networking'] },
    { label: 'Outreach', subcategories: ['Cold DMs', 'Proposals', 'Follow-ups'] },
    { label: 'Sales', subcategories: ['Calls', 'Negotiations', 'Contracts'] },
    { label: 'Operations', subcategories: ['Invoicing', 'Planning', 'Documentation'] },
  ],
  trading_os: [
    { label: 'Product Development', subcategories: ['Frontend', 'Backend', 'Database', 'APIs', 'Architecture'] },
    { label: 'Testing', subcategories: ['Unit Tests', 'Data Validation', 'Regression', 'QA', 'Manual Testing'] },
    { label: 'Bug Fixing', subcategories: ['Issue Triage', 'Hotfixes', 'Debugging', 'Refactoring'] },
    { label: 'Product Research', subcategories: ['Market Research', 'Competitor Analysis', 'Feature Planning', 'Design'] },
    { label: 'Distribution', subcategories: ['Social Content', 'Community', 'Direct Outreach', 'Demo Calls', 'Launches'] },
    { label: 'User Research', subcategories: ['User Interviews', 'Feedback Review', 'Usability Testing', 'Onboarding'] },
    { label: 'SaaS Operations', subcategories: ['Infrastructure', 'Documentation', 'Compliance', 'Metrics Review'] },
  ],
  forex: [
    { label: 'Study', subcategories: ['Fundamentals', 'Technical Analysis', 'Price Action', 'Psychology'] },
    { label: 'Backtesting', subcategories: ['Strategy Testing', 'Data Analysis', 'Journal Review'] },
    { label: 'Paper Trading', subcategories: ['Live Practice', 'Trade Review', 'Setup Documentation'] },
  ],
  fitness: [
    { label: 'Gym', subcategories: ['Push', 'Pull', 'Legs', 'Upper', 'Lower', 'Full Body'] },
    { label: 'Running', subcategories: ['5K', 'Tempo', 'Recovery'] },
    { label: 'Football', subcategories: ['Match', 'Practice'] },
    { label: 'Mental', subcategories: ['Chess', 'Sudoku'] },
  ],
  voire: [
    { label: 'Creative Studio', subcategories: ['Concepts', 'Typography', 'Illustrations', 'Mockups', 'Visual Identity'] },
    { label: 'Production & Sampling', subcategories: ['Print-on-Demand Testing', 'Tech Packs', 'Blank Sourcing', 'Strike-offs'] },
    { label: 'Marketing & Distribution', subcategories: ['Lookbooks', 'Reels', 'Influencers', 'Email Drops', 'Campaign Ads'] },
    { label: 'Commerce & Operations', subcategories: ['Shopify Config', 'Catalog Setup', 'Order Fulfillment', 'P&L Review'] },
  ],
};

// Quick-capture event types per pillar
export const QUICK_EVENTS: Record<string, { label: string; emoji: string; eventType: string }[]> = {
  job_hunt: [
    { label: 'Applied', emoji: '📨', eventType: 'JOB_APPLICATION_SUBMITTED' },
    { label: 'Sent Outreach', emoji: '💬', eventType: 'JOB_OUTREACH_SENT' },
    { label: 'Got Reply', emoji: '📩', eventType: 'JOB_REPLY_RECEIVED' },
    { label: 'Interview Booked', emoji: '🎯', eventType: 'JOB_INTERVIEW_BOOKED' },
    { label: 'Assessment Done', emoji: '📝', eventType: 'JOB_ASSESSMENT_DONE' },
    { label: 'Discovered Role', emoji: '🔍', eventType: 'JOB_OPPORTUNITY_DISCOVERED' },
  ],
  agency: [
    { label: 'Client Call', emoji: '📞', eventType: 'AGENCY_CLIENT_CALL' },
    { label: 'Sent Proposal', emoji: '📄', eventType: 'AGENCY_PROPOSAL_SENT' },
    { label: 'Payment In', emoji: '💰', eventType: 'AGENCY_PAYMENT_RECEIVED' },
    { label: 'Lead Found', emoji: '🎣', eventType: 'AGENCY_LEAD_FOUND' },
    { label: 'Delivered', emoji: '✅', eventType: 'AGENCY_DELIVERABLE_DONE' },
    { label: 'Follow-up', emoji: '🔄', eventType: 'AGENCY_FOLLOW_UP' },
  ],
  trading_os: [
    { label: 'Feature Done', emoji: '🚀', eventType: 'SAAS_FEATURE_COMPLETED' },
    { label: 'Bug Fixed', emoji: '🐛', eventType: 'SAAS_BUG_FIXED' },
    { label: 'User Registered', emoji: '👤', eventType: 'SAAS_USER_REGISTERED' },
    { label: 'Post Published', emoji: '📢', eventType: 'SAAS_CONTENT_PUBLISHED' },
    { label: 'Feedback', emoji: '💡', eventType: 'SAAS_FEEDBACK_RECEIVED' },
    { label: 'Released', emoji: '🏷️', eventType: 'SAAS_VERSION_RELEASED' },
  ],
  forex: [
    { label: 'Studied 30m', emoji: '📖', eventType: 'FOREX_STUDY_SESSION' },
    { label: 'Paper Trade', emoji: '📊', eventType: 'FOREX_PAPER_TRADE' },
    { label: 'Backtest', emoji: '🔬', eventType: 'FOREX_BACKTEST_RUN' },
    { label: 'Rule Violation', emoji: '⚠️', eventType: 'FOREX_RULE_VIOLATION' },
    { label: 'Setup Documented', emoji: '📋', eventType: 'FOREX_SETUP_DOCUMENTED' },
  ],
  fitness: [
    { label: 'Meal Log', emoji: '🍽️', eventType: 'FITNESS_MEAL_LOGGED' },
    { label: 'Ran 5K', emoji: '🏃', eventType: 'FITNESS_RUN_COMPLETED' },
    { label: 'Gym Done', emoji: '💪', eventType: 'FITNESS_WORKOUT_DONE' },
    { label: 'Weight Log', emoji: '⚖️', eventType: 'FITNESS_WEIGHT_LOGGED' },
    { label: 'Supplement', emoji: '💊', eventType: 'FITNESS_SUPPLEMENT_TAKEN' },
    { label: 'Sleep Log', emoji: '😴', eventType: 'FITNESS_SLEEP_LOGGED' },
  ],
  voire: [
    { label: 'Design Idea', emoji: '✨', eventType: 'VOIRE_DESIGN_CREATED' },
    { label: 'Order In', emoji: '🛒', eventType: 'VOIRE_ORDER_RECORDED' },
    { label: 'Campaign Logged', emoji: '📢', eventType: 'VOIRE_MARKETING_CAMPAIGN_LOGGED' },
    { label: 'Drop Launched', emoji: '🚀', eventType: 'VOIRE_DROP_LAUNCHED' },
    { label: 'Product Ready', emoji: '👕', eventType: 'VOIRE_PRODUCT_CREATED' },
    { label: 'Design Approved', emoji: '✅', eventType: 'VOIRE_DESIGN_STAGE_CHANGED' },
  ],
};
