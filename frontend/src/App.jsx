import { useState, useEffect, lazy, Suspense, Component } from 'react';
import { AuthProvider } from './context/AuthContext.jsx';
import Sidebar from './components/Sidebar.jsx';
import TrialBanner from './components/TrialBanner.jsx';
import UpgradeModal from './components/UpgradeModal.jsx';
import { UpgradeProvider } from './context/UpgradeContext.jsx';
import ConfirmDialog from './components/ConfirmDialog.jsx';
import { ConfirmProvider } from './context/ConfirmContext.jsx';
import ToastStack from './components/ToastStack.jsx';
import { ToastProvider } from './context/ToastContext.jsx';

const Login        = lazy(() => import('./pages/Login.jsx'));
const Signup       = lazy(() => import('./pages/Signup.jsx'));
const ResetPassword = lazy(() => import('./pages/ResetPassword.jsx'));
const BookingForm  = lazy(() => import('./pages/BookingForm.jsx'));
const Landing      = lazy(() => import('./pages/Landing.jsx'));
const PaywallScreen = lazy(() => import('./pages/PaywallScreen.jsx'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy.jsx'));
const TermsOfService = lazy(() => import('./pages/TermsOfService.jsx'));
const DataDeletion = lazy(() => import('./pages/DataDeletion.jsx'));
const Overview     = lazy(() => import('./pages/Overview.jsx'));
const Kanban       = lazy(() => import('./pages/Kanban.jsx'));
const Orders       = lazy(() => import('./pages/Orders.jsx'));
const Customers    = lazy(() => import('./pages/Customers.jsx'));
const Services     = lazy(() => import('./pages/Services.jsx'));
const Messaging    = lazy(() => import('./pages/Messaging.jsx'));
const SuperAdmin   = lazy(() => import('./pages/SuperAdmin.jsx'));
const Reports      = lazy(() => import('./pages/Reports.jsx'));
const Finance      = lazy(() => import('./pages/Finance.jsx'));
const Inventory    = lazy(() => import('./pages/Inventory.jsx'));
const FAQs         = lazy(() => import('./pages/FAQs.jsx'));
const Users        = lazy(() => import('./pages/Users.jsx'));
const DeliveryZones = lazy(() => import('./pages/DeliveryZones.jsx'));
const Settings     = lazy(() => import('./pages/Settings.jsx'));
const WalkIn       = lazy(() => import('./pages/WalkIn.jsx'));
const Branches     = lazy(() => import('./pages/Branches.jsx'));

class PageErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) return (
      <div style={{ padding: '2rem', color: '#A32D2D', fontSize: 14 }}>
        Failed to load page. Please refresh.
        <button onClick={() => window.location.reload()}
          style={{ marginLeft: 12, padding: '5px 14px', borderRadius: 6, border: 'none', background: 'var(--primary)', color: '#fff', cursor: 'pointer', fontSize: 13 }}>
          Refresh
        </button>
      </div>
    );
    return this.props.children;
  }
}
import { getSubscription, getPublicTenantByDomain } from './api.js';
import { useAuth } from './context/AuthContext.jsx';
import { usePushNotifications } from './hooks/usePushNotifications.js';

const PLATFORM_HOSTS = ['laundrobot.app', 'www.laundrobot.app', 'localhost', '127.0.0.1'];
const isCustomDomain = !PLATFORM_HOSTS.some(h => window.location.hostname === h || window.location.hostname.endsWith('.vercel.app'));

// On a custom domain every path serves the tenant's booking form
function CustomDomainApp() {
  const [tenantId, setTenantId]     = useState(null);
  const [whiteLabel, setWhiteLabel] = useState(false);
  const [error, setError]           = useState('');

  useEffect(() => {
    getPublicTenantByDomain(window.location.hostname)
      .then(r => { setTenantId(r.data.tenant_id); setWhiteLabel(r.data.white_label); })
      .catch(() => setError('This domain is not configured. Please contact support.'));
  }, []);

  if (error) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif', color: '#374151' }}>
      <p>{error}</p>
    </div>
  );
  if (!tenantId) return null;
  return <Suspense fallback={null}><BookingForm tenantId={tenantId} whiteLabel={whiteLabel} /></Suspense>;
}

const PAGES = {
  Overview, Kanban, Orders, Customers, Services,
  Messaging, FAQs, Users, Reports, Finance, Inventory, SuperAdmin, DeliveryZones, Settings, WalkIn, Branches,
};

const PAGE_TITLES = {
  Overview:   'Overview',
  Kanban:     'Kanban Board',
  Orders:     'Orders',
  Customers:  'Customers',
  Services:   'Services & Pricing',
  Messaging:  'Messaging',
  FAQs:       'FAQs',
  Users:      'User Management',
  Reports:    'Reports',
  Finance:    'Finance',
  Inventory:  'Inventory',
  SuperAdmin:     'Super Admin',
  DeliveryZones:  'Delivery Zones',
  Settings:       'Settings',
  WalkIn:         'Walk In',
  Branches:       'Branches',
};

function Dashboard({ initialPage }) {
  const { user, setBranchLimit } = useAuth();
  const [page, setPage] = useState(initialPage || 'Kanban');
  usePushNotifications();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [subStatus, setSubStatus] = useState(null); // null = loading
  const [subPlan,   setSubPlan]   = useState('starter');
  const Page = PAGES[page] || Overview;

  useEffect(() => {
    const title = PAGE_TITLES[page] || page;
    document.title = `${title} — LaundroBot`;
  }, [page]);

  // Check subscription on mount; superadmin is always exempt
  useEffect(() => {
    if (user.role === 'superadmin') { setSubStatus('active'); setSubPlan('pro'); return; }
    getSubscription()
      .then(r => {
        setSubStatus(r.data.subscription_status || 'active');
        setSubPlan(r.data.subscription_plan   || 'starter');
        if (r.data.branch_limit) setBranchLimit(r.data.branch_limit);
      })
      .catch(err => {
        console.error('Subscription check failed', err);
        setSubStatus('error');
        // Don't grant access on failure
      });
  }, [user.role]);

  // While checking, show nothing (or you could show a spinner)
  if (subStatus === null) return null;

  // Subscription check failed — require re-login rather than granting access
  if (subStatus === 'error') return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif', color: '#374151', flexDirection: 'column', gap: 16 }}>
      <p style={{ fontSize: 15, fontWeight: 600 }}>Cannot verify subscription. Please sign in again.</p>
      <button onClick={() => { window.dispatchEvent(new Event('auth:logout')); }} style={{ padding: '9px 22px', borderRadius: 8, background: 'var(--primary)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>Sign Out</button>
    </div>
  );

  // Trial expired → paywall
  if (subStatus === 'expired') return <Suspense fallback={null}><PaywallScreen /></Suspense>;

  function navigate(p) {
    setPage(p);
    setSidebarOpen(false);
  }

  return (
    <ToastProvider>
    <ConfirmProvider>
    <UpgradeProvider plan={subStatus === 'trial' ? 'pro' : subPlan}>
    <UpgradeModal />
    <ConfirmDialog />
    <ToastStack />
    <div className="dashboard-layout" style={{ display: 'flex', minHeight: '100vh', background: '#F7F7F5', flexDirection: 'column' }}>
      {/* Trial banner — only shown for trial tenants */}
      {user.role !== 'superadmin' && <TrialBanner />}

      {/* ── Mobile top bar ── */}
      <div className="mobile-topbar">
        <button className="hamburger-btn" onClick={() => setSidebarOpen(o => !o)} aria-label="Open menu">
          ☰
        </button>
        <span className="mobile-topbar-title">{PAGE_TITLES[page] || page}</span>
        <img src="/logo.png" alt="LaundroBot" style={{ width: 28, height: 28, borderRadius: 5, objectFit: 'contain' }} />
      </div>

      {/* ── Main row (sidebar + content) ── */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <Sidebar current={page} onNav={navigate} role={user.role} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="dashboard-main" style={{
          flex: 1, padding: '1.75rem 2rem', overflowY: 'auto',
          maxWidth: 'calc(100vw - 230px)',
        }}>
          {page === 'SuperAdmin' && user.role !== 'superadmin'
            ? <div style={{ padding: '2rem', color: '#A32D2D', fontSize: 15, fontWeight: 600 }}>Access denied.</div>
            : <PageErrorBoundary><Suspense fallback={<div style={{ color: '#6B7280', fontSize: 13, padding: '2rem' }}>Loading…</div>}><Page /></Suspense></PageErrorBoundary>}
        </main>
      </div>
    </div>
    </UpgradeProvider>
    </ConfirmProvider>
    </ToastProvider>
  );
}

function Inner() {
  const { user } = useAuth();

  // Public booking form — /book/:tenantId
  const bookMatch = window.location.pathname.match(/^\/book\/([a-f0-9-]{36})$/i);
  if (bookMatch) return <Suspense fallback={null}><BookingForm tenantId={bookMatch[1]} /></Suspense>;

  const params     = new URLSearchParams(window.location.search);
  const resetToken = params.get('reset_token');
  if (resetToken) {
    document.title = 'Reset Password — LaundroBot';
    return (
      <Suspense fallback={null}>
        <ResetPassword
          token={resetToken}
          onBack={() => {
            window.history.replaceState({}, '', window.location.pathname);
            window.location.reload();
          }}
        />
      </Suspense>
    );
  }

  const path = window.location.pathname;

  if (path === '/privacy')       return <Suspense fallback={null}><PrivacyPolicy /></Suspense>;
  if (path === '/terms')         return <Suspense fallback={null}><TermsOfService /></Suspense>;
  if (path === '/data-deletion') return <Suspense fallback={null}><DataDeletion /></Suspense>;

  if (!user) {
    if (path === '/login') {
      document.title = 'Sign In — LaundroBot';
      return <Suspense fallback={null}><Login /></Suspense>;
    }
    if (path === '/signup') {
      document.title = 'Start Free Trial — LaundroBot';
      return <Suspense fallback={null}><Signup /></Suspense>;
    }
    return <Suspense fallback={null}><Landing /></Suspense>;
  }

  // Intercept Facebook OAuth return before Dashboard renders
  const oauthCode  = params.get('code');
  const oauthState = params.get('state');
  if (oauthCode && oauthState) {
    sessionStorage.setItem('fb_oauth_pending', JSON.stringify({
      code: oauthCode,
      state: oauthState,
      redirectUri: window.location.origin + '/settings',
      ts: Date.now(),
    }));
    window.history.replaceState({}, '', '/settings');
    return <Dashboard initialPage="Settings" />;
  }

  return <Dashboard />;
}

export default function App() {
  if (isCustomDomain) return <CustomDomainApp />;
  return (
    <AuthProvider>
      <Inner />
    </AuthProvider>
  );
}
