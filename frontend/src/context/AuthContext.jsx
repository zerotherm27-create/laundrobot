import { createContext, useContext, useState, useEffect } from 'react';
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

  async function login(email, password, keepLoggedIn = false) {
    const { data } = await apiLogin(email, password, keepLoggedIn);
    const permissions = data.permissions || [];
    saveToken(data.token, keepLoggedIn);
    localStorage.setItem('role',        data.role);
    localStorage.setItem('tenant_id',   data.tenant_id   || '');
    localStorage.setItem('tenant_name', data.tenant_name || '');
    localStorage.setItem('email',       data.email       || email);
    localStorage.setItem('permissions', JSON.stringify(permissions));
    setUser({
      token:       data.token,
      role:        data.role,
      tenant_id:   data.tenant_id,
      tenant_name: data.tenant_name,
      email:       data.email || email,
      permissions,
    });
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
