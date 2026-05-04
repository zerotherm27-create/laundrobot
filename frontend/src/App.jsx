import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import Login from './pages/Login.jsx';
import Signup from './pages/Signup.jsx';
import ResetPassword from './pages/ResetPassword.jsx';
import BookingForm from './pages/BookingForm.jsx';
import Sidebar from './components/Sidebar.jsx';
import TrialBanner from './components/TrialBanner.jsx';
import Overview from './pages/Overview.jsx';
import Kanban from './pages/Kanban.jsx';
import Orders from './pages/Orders.jsx';
import Customers from './pages/Customers.jsx';
import Services from './pages/Services.jsx';
import Messaging from './pages/Messaging.jsx';
import SuperAdmin from './pages/SuperAdmin.jsx';
import Reports from './pages/Reports.jsx';
import FAQs from './pages/FAQs.jsx';
import Users from './pages/Users.jsx';
import DeliveryZones from './pages/DeliveryZones.jsx';
import Settings from './pages/Settings.jsx';
import WalkIn from './pages/WalkIn.jsx';
import Landing from './pages/Landing.jsx';
import PaywallScreen from './pages/PaywallScreen.jsx';
import PrivacyPolicy from './pages/PrivacyPolicy.jsx';
import TermsOfService from './pages/TermsOfService.jsx';
import { getSubscription } from './api.js';

const PAGES = {
  Overview, Kanban, Orders, Customers, Services,
  Messaging, FAQs, Users, Reports, SuperAdmin, DeliveryZones, Settings, WalkIn,
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
  SuperAdmin:     'Super Admin',
  DeliveryZones:  'Delivery Zones',
  Settings:       'Settings',
  WalkIn:         'Walk-in POS',
};

function Dashboard() {
  const { user } = useAuth();
  const [page, setPage] = useState('Kanban');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [subStatus, setSubStatus] = useState(null); // null = loading
  const Page = PAGES[page] || Overview;

  useEffect(() => {
    const title = PAGE_TITLES[page] || page;
    document.title = `${title} — LaundroBot`;
  }, [page]);

  // Check subscription on mount; superadmin is always exempt
  useEffect(() => {
    if (user.role === 'superadmin') { setSubStatus('active'); return; }
    getSubscription()
      .then(r => setSubStatus(r.data.subscription_status))
      .catch(() => setSubStatus('active')); // fail open
  }, [user.role]);

  // While checking, show nothing (or you could show a spinner)
  if (subStatus === null) return null;

  // Trial expired → paywall
  if (subStatus === 'expired') return <PaywallScreen />;

  function navigate(p) {
    setPage(p);
    setSidebarOpen(false);
  }

  return (
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
          <Page />
        </main>
      </div>
    </div>
  );
}

function Inner() {
  const { user } = useAuth();

  // Public booking form — /book/:tenantId
  const bookMatch = window.location.pathname.match(/^\/book\/([a-f0-9-]{36})$/i);
  if (bookMatch) return <BookingForm tenantId={bookMatch[1]} />;

  const params     = new URLSearchParams(window.location.search);
  const resetToken = params.get('reset_token');
  if (resetToken) {
    document.title = 'Reset Password — LaundroBot';
    return (
      <ResetPassword
        token={resetToken}
        onBack={() => {
          window.history.replaceState({}, '', window.location.pathname);
          window.location.reload();
        }}
      />
    );
  }

  const path = window.location.pathname;

  if (path === '/privacy') return <PrivacyPolicy />;
  if (path === '/terms')   return <TermsOfService />;

  if (!user) {
    if (path === '/login') {
      document.title = 'Sign In — LaundroBot';
      return <Login />;
    }
    if (path === '/signup') {
      document.title = 'Start Free Trial — LaundroBot';
      return <Signup />;
    }
    return <Landing />;
  }

  return <Dashboard />;
}

export default function App() {
  return (
    <AuthProvider>
      <Inner />
    </AuthProvider>
  );
}
