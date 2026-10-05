import { createContext, useContext, useState, useEffect } from 'react';
import { saveOfflineSession, openOfflineSession } from '../utils/offlineAuth.js';
import { login as apiLogin, getMyBranches, switchBranch as apiSwitchBranch } from '../api.js';

const AuthContext = createContext();

function getToken() {
  return localStorage.getItem('token') || sessionStorage.getItem('token');
}

function saveToken(token, persistent) {
  if (persistent) {
    localStorage.setItem('token', token);
    localStorage.setItem('token_persistent', '1');
    sessionStorage.removeItem('token');
  } else {
    sessionStorage.setItem('token', token);
    localStorage.removeItem('token');
    localStorage.removeItem('token_persistent');
  }
}

function isPersistent() {
  return !!localStorage.getItem('token_persistent');
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const token = getToken();
      if (!token) return null;
      return {
        token,
        role:        localStorage.getItem('role'),
        tenant_id:   localStorage.getItem('tenant_id'),
        tenant_name: localStorage.getItem('tenant_name'),
        email:       localStorage.getItem('email'),
        permissions: JSON.parse(localStorage.getItem('permissions') || '[]'),
      };
    } catch { return null; }
  });

  const [branches,    setBranches]    = useState([]);
  const [branchLimit, setBranchLimit] = useState(1);

  // Load branches whenever a logged-in non-superadmin session is active
  useEffect(() => {
    if (!user?.tenant_id) return;
    getMyBranches().then(r => setBranches(r.data || [])).catch(() => {});
  }, [user?.tenant_id]);

  function applySession(token, persistent, p) {
    saveToken(token, persistent);
    localStorage.setItem('role',        p.role);
    localStorage.setItem('tenant_id',   p.tenant_id   || '');
    localStorage.setItem('tenant_name', p.tenant_name || '');
    localStorage.setItem('email',       p.email);
    localStorage.setItem('permissions', JSON.stringify(p.permissions));
    setUser({ token, ...p });
  }

  async function login(email, password, keepLoggedIn = false) {
    let data;
    try {
      ({ data } = await apiLogin(email, password, keepLoggedIn));
    } catch (err) {
      // No server response = offline/unreachable: fall back to the encrypted session saved
      // on this device by a previous online login (see utils/offlineAuth.js).
      if (!err.response) {
        const saved = await openOfflineSession(email, password);
        if (saved) { applySession(saved.token, saved.persistent, saved.profile); return; }
        err.offlineNoSession = true;
      }
      throw err;
    }
    const profile = {
      role:        data.role,
      tenant_id:   data.tenant_id,
      tenant_name: data.tenant_name,
      email:       data.email || email,
      permissions: data.permissions || [],
    };
    applySession(data.token, keepLoggedIn, profile);
    saveOfflineSession(email, password, { token: data.token, persistent: keepLoggedIn, profile });
  }

  async function switchToBranch(tenantId) {
    const { data } = await apiSwitchBranch(tenantId);
    saveToken(data.token, isPersistent());
    localStorage.setItem('tenant_id',   data.tenant_id);
    localStorage.setItem('tenant_name', data.tenant_name);
    window.location.reload();
  }

  function logout() {
    sessionStorage.removeItem('token');
    ['token','token_persistent','role','tenant_id','tenant_name','email','permissions'].forEach(k => localStorage.removeItem(k));
    // Signed-out users land on the dedicated sign-in page, not the marketing landing page.
    window.history.replaceState({}, '', '/login');
    setUser(null);
  }

  useEffect(() => {
    window.addEventListener('auth:logout', logout);
    return () => window.removeEventListener('auth:logout', logout);
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, branches, setBranches, branchLimit, setBranchLimit, switchToBranch }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
