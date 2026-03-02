import { useState, useEffect, useRef, useTransition, lazy, Suspense } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Modal } from './components/shared';
import Header from './components/Header';
import TabNav from './components/TabNav';
import AuthScreen from './components/AuthScreen';
import SubscriptionBanner from './components/SubscriptionBanner';
import UpgradeModal from './components/UpgradeModal';
import { isSubscriptionActive } from './utils/auth';
import WorkflowGuide from './components/WorkflowGuide';
import ToastContainer from './components/Toast';
import ErrorBoundary from './components/ErrorBoundary';

const BedsTab = lazy(() => import('./tabs/BedsTab'));
const TasksTab = lazy(() => import('./tabs/TasksTab'));
const PlannerTab = lazy(() => import('./tabs/PlannerTab'));
const HarvestTab = lazy(() => import('./tabs/HarvestTab'));
const PestsTab = lazy(() => import('./tabs/PestsTab'));
const WeatherTab = lazy(() => import('./tabs/WeatherTab'));
const IrrigationTab = lazy(() => import('./tabs/IrrigationTab'));
const ScheduleTab = lazy(() => import('./tabs/ScheduleTab'));
const RotationTab = lazy(() => import('./tabs/RotationTab'));
const CompanionsTab = lazy(() => import('./tabs/CompanionsTab'));
const CalculatorTab = lazy(() => import('./tabs/CalculatorTab'));
const CropsTab = lazy(() => import('./tabs/CropsTab'));
const EventsTab = lazy(() => import('./tabs/EventsTab'));
const NurseryTab = lazy(() => import('./tabs/NurseryTab'));
const ProfileTab = lazy(() => import('./tabs/ProfileTab'));
const AnalyticsTab = lazy(() => import('./tabs/AnalyticsTab'));

function TabFallback({ theme }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '60px 20px', color: theme.textMuted }}>
      <span style={{ fontSize: '24px', marginRight: '8px' }}>🌱</span> Loading...
    </div>
  );
}

function AppContent() {
  const { theme, user, setupProgress, updateSubscription, showToast } = useApp();
  const [activeTab, setActiveTab] = useState('farm');
  const [upgradeModal, setUpgradeModal] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [planSubTab, setPlanSubTab] = useState('planning');
  const mainRef = useRef(null);
  const [, startTransition] = useTransition();

  // Focus main content on tab switch (startTransition avoids Suspense errors with lazy tabs)
  const handleTabChange = (tab) => {
    startTransition(() => { setActiveTab(tab); });
    requestAnimationFrame(() => { mainRef.current?.focus(); });
  };

  // Detect Stripe payment redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('payment_success') === 'true' && user) {
      updateSubscription({ plan: 'paid', paidAt: new Date().toISOString() });
      window.history.replaceState({}, '', window.location.pathname);
      showToast('Payment successful! Welcome to BioGrow Premium.', { type: 'success', duration: 8000 });
    }
    if (params.get('payment_cancelled') === 'true') {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auth gate — show login screen if no user
  if (!user) {
    return <AuthScreen />;
  }

  // Show guide on first visit (after auth)
  const guideOpen = showGuide || (!setupProgress?.guideSeen && user);

  const subActive = isSubscriptionActive(user.subscription);

  const renderTab = () => {
    // If subscription expired, lock all tabs except profile
    if (!subActive && activeTab !== 'profile') {
      return (
        <div style={{ padding: '60px 20px', textAlign: 'center', maxWidth: '500px', margin: '0 auto' }}>
          <div style={{ fontSize: '64px', marginBottom: '16px' }}>🔒</div>
          <h2 style={{ fontFamily: "'DM Serif Display', serif", color: theme.text, marginBottom: '12px' }}>
            Trial Expired
          </h2>
          <p style={{ color: theme.textSecondary, fontSize: '14px', marginBottom: '24px', lineHeight: '1.6' }}>
            Your 30-day free trial has ended. Upgrade to continue using all BioGrow features. Your data is safe and will be available when you upgrade.
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => setUpgradeModal(true)}
              style={{
                padding: '12px 28px',
                borderRadius: '10px',
                border: 'none',
                background: 'linear-gradient(135deg, #5d4e37, #3e6b48)',
                color: '#fff',
                fontSize: '14px',
                fontWeight: '700',
                cursor: 'pointer',
                fontFamily: "'Libre Franklin', sans-serif",
              }}
            >
              Upgrade Now
            </button>
            <button
              onClick={() => setActiveTab('profile')}
              style={{
                padding: '12px 28px',
                borderRadius: '10px',
                border: `1.5px solid ${theme.border}`,
                background: 'transparent',
                color: theme.text,
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                fontFamily: "'Libre Franklin', sans-serif",
              }}
            >
              Go to Profile
            </button>
          </div>
        </div>
      );
    }

    const E = ErrorBoundary;
    switch (activeTab) {
      case 'farm': return <E tabName="Farm" key="farm"><BedsTab onNavigate={setActiveTab} /></E>;
      case 'demand': return <E tabName="Demand" key="demand"><EventsTab onNavigate={setActiveTab} /></E>;
      case 'plan': return (
        <E tabName="Plan" key="plan">
          <div style={{
            display: 'flex', gap: '4px', padding: '8px 16px',
            background: theme.bg, borderBottom: `1px solid ${theme.borderLight}`,
          }}>
            {[
              { id: 'planning', label: '📋 Planning' },
              { id: 'schedule', label: '📅 Schedule' },
            ].map(sub => (
              <button
                key={sub.id}
                onClick={() => setPlanSubTab(sub.id)}
                style={{
                  padding: '6px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                  fontFamily: "'Libre Franklin', sans-serif", fontSize: '13px',
                  fontWeight: planSubTab === sub.id ? '600' : '400',
                  background: planSubTab === sub.id ? (theme.accentLight || '#e8f5e9') : 'transparent',
                  color: planSubTab === sub.id ? theme.accent : theme.textSecondary,
                  transition: 'all 0.2s',
                }}
              >
                {sub.label}
              </button>
            ))}
          </div>
          {planSubTab === 'planning' ? <PlannerTab onNavigate={setActiveTab} /> : <ScheduleTab />}
        </E>
      );
      case 'nursery': return <E tabName="Nursery" key="nursery"><NurseryTab /></E>;
      case 'harvest': return <E tabName="Harvest" key="harvest"><HarvestTab /></E>;
      case 'tasks': return <E tabName="Tasks" key="tasks"><TasksTab /></E>;
      case 'crops': return <E tabName="Crops" key="crops"><CropsTab /></E>;
      case 'rotation': return <E tabName="Rotation" key="rotation"><RotationTab /></E>;
      case 'companions': return <E tabName="Companions" key="companions"><CompanionsTab /></E>;
      case 'calculator': return <E tabName="Calculator" key="calculator"><CalculatorTab /></E>;
      case 'pests': return <E tabName="Pests" key="pests"><PestsTab /></E>;
      case 'weather': return <E tabName="Weather" key="weather"><WeatherTab /></E>;
      case 'irrigation': return <E tabName="Irrigation" key="irrigation"><IrrigationTab /></E>;
      case 'analytics': return <E tabName="Analytics" key="analytics"><AnalyticsTab /></E>;
      case 'profile': return <E tabName="Profile" key="profile"><ProfileTab /></E>;
      default: return <E tabName="Farm" key="farm-default"><BedsTab /></E>;
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: theme.bg,
      color: theme.text,
      fontFamily: "'Libre Franklin', sans-serif",
      transition: 'background 0.3s, color 0.3s',
    }}>
      <a href="#main-content" style={{
        position: 'absolute', left: '-9999px', top: 'auto', width: '1px', height: '1px', overflow: 'hidden',
        zIndex: 9999, padding: '8px 16px', background: theme.accent, color: '#fff', textDecoration: 'none',
        borderRadius: '0 0 8px 0', fontFamily: "'Libre Franklin', sans-serif", fontSize: '14px',
      }} onFocus={(e) => { e.target.style.left = '0'; e.target.style.width = 'auto'; e.target.style.height = 'auto'; }}
         onBlur={(e) => { e.target.style.left = '-9999px'; e.target.style.width = '1px'; e.target.style.height = '1px'; }}>
        Skip to content
      </a>
      <Header onProfileClick={() => handleTabChange('profile')} onShowGuide={() => setShowGuide(true)} />
      <SubscriptionBanner onUpgrade={() => setUpgradeModal(true)} />
      <TabNav activeTab={activeTab} setActiveTab={handleTabChange} />
      <main
        ref={mainRef}
        id="main-content"
        role="tabpanel"
        tabIndex={-1}
        style={{ minHeight: 'calc(100vh - 140px)', outline: 'none' }}
      >
        <Suspense fallback={<TabFallback theme={theme} />}>
          {renderTab()}
        </Suspense>
      </main>
      <footer style={{
        textAlign: 'center',
        padding: '20px 16px',
        fontSize: '12px',
        color: theme.textMuted,
        borderTop: `1px solid ${theme.borderLight}`,
        lineHeight: '1.8',
      }}>
        <div>🌱 BioGrow — Bio-Intensive Market Garden Planner</div>
        <div style={{ marginTop: '4px' }}>
          Created by Pedro Valdjiu —{' '}
          <a href="https://www.terralta.org" target="_blank" rel="noopener noreferrer" style={{ color: theme.accent, textDecoration: 'none' }}>Terra Alta</a>
        </div>
        <div style={{ marginTop: '6px', display: 'flex', justifyContent: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <button
            onClick={() => window.location.href = 'mai' + 'lto:' + 'terraalta' + '.sintra' + '@gma' + 'il.com'}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: theme.accent, fontSize: '12px', padding: 0, textDecoration: 'underline' }}
          >
            Contact Us
          </button>
          <button
            onClick={() => setShowDisclaimer(true)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: theme.textMuted, fontSize: '12px', padding: 0, textDecoration: 'underline' }}
          >
            Disclaimer
          </button>
        </div>
      </footer>

      {/* Disclaimer Modal */}
      <Modal open={showDisclaimer} onClose={() => setShowDisclaimer(false)} title="Disclaimer" width="550px">
        <div style={{ fontSize: '13px', color: theme.textSecondary, lineHeight: '1.7' }}>
          <p style={{ marginBottom: '12px' }}>
            BioGrow is provided "as is" without warranty of any kind. Crop data, yield estimates, planting schedules, and all other information are approximate guidelines based on general horticultural knowledge and should not be considered professional agricultural advice.
          </p>
          <p style={{ marginBottom: '12px' }}>
            Results may vary depending on your local climate, soil conditions, farming practices, and other factors. Always consult local agricultural resources and professionals for decisions that affect your livelihood.
          </p>
          <p style={{ marginBottom: '12px' }}>
            All user data is stored locally in your browser. We do not collect, transmit, or store any personal information on external servers. You are responsible for backing up your own data.
          </p>
          <p style={{ marginBottom: '0' }}>
            The creators of BioGrow accept no liability for crop losses, planning errors, or any other consequences arising from the use of this application.
          </p>
          <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: `1px solid ${theme.borderLight}`, fontSize: '12px', color: theme.textMuted }}>
            © {new Date().getFullYear()} Pedro Valdjiu — <a href="https://www.terralta.org" target="_blank" rel="noopener noreferrer" style={{ color: theme.accent, textDecoration: 'none' }}>Terra Alta</a>
          </div>
        </div>
      </Modal>
      <UpgradeModal open={upgradeModal} onClose={() => setUpgradeModal(false)} />
      <WorkflowGuide open={!!guideOpen} onClose={() => setShowGuide(false)} />
      <ToastContainer />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { margin: 0; -webkit-font-smoothing: antialiased; }
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #b8a898; border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: #9e8e82; }
        @media (max-width: 768px) {
          main { padding: 0 !important; }
        }
      `}</style>
      <AppContent />
    </AppProvider>
  );
}
