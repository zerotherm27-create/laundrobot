import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import Login from './pages/Login.jsx';
import ResetPassword from './pages/ResetPassword.jsx';
import BookingForm from './pages/BookingForm.jsx';
import Sidebar from './components/Sidebar.jsx';
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

const PAGES = {
  Overview, Kanban, Orders, Customers, Services,
  Messaging, FAQs, Users, Reports, SuperAdmin, DeliveryZones, Settings,
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
};

function Dashboard() {
  const { user } = useAuth();
  const [page, setPage] = useState('Kanban');
  const Page = PAGES[page] || Overview;

  // Update page title on navigation
  useEffect(() => {
    const title = PAGE_TITLES[page] || page;
    document.title = `${title} — LaundroBot`;
  }, [page]);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F7F7F5' }}>
      <Sidebar current={page} onNav={setPage} role={user.role} />
      <main style={{
        flex: 1, padding: '1.75rem 2rem', overflowY: 'auto',
        maxWidth: 'calc(100vw - 230px)',
      }}>
        <Page />
      </main>
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

  if (!user) {
    document.title = 'Sign In — LaundroBot';
    return <Login />;
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
