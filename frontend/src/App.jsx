import { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import Login from './pages/Login.jsx';
import ResetPassword from './pages/ResetPassword.jsx';
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

const PAGES = {
  Overview,
  Kanban,
  Orders,
  Customers,
  Services,
  Messaging,
  FAQs,
  Reports,
  SuperAdmin,
};

function Dashboard() {
  const { user } = useAuth();
  const [page, setPage] = useState('Kanban');
  const Page = PAGES[page] || Overview;

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar current={page} onNav={setPage} role={user.role} />
      <main style={{ flex: 1, padding: '1.5rem', overflowY: 'auto' }}>
        <Page />
      </main>
    </div>
  );
}

function Inner() {
  const { user } = useAuth();

  // Check for password reset token in URL
  const params = new URLSearchParams(window.location.search);
  const resetToken = params.get('reset_token');
  if (resetToken) {
    return (
      <ResetPassword
        token={resetToken}
        onBack={() => {
          // Remove token from URL and go back to login
          window.history.replaceState({}, '', window.location.pathname);
          window.location.reload();
        }}
      />
    );
  }

  return user ? <Dashboard /> : <Login />;
}

export default function App() {
  return (
    <AuthProvider>
      <Inner />
    </AuthProvider>
  );
}
