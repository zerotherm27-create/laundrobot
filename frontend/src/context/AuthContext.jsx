import { createContext, useContext, useState } from 'react';
import { login as apiLogin } from '../api.js';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const token = localStorage.getItem('token');
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

  async function login(email, password) {
    const { data } = await apiLogin(email, password);
    const permissions = data.permissions || [];
    localStorage.setItem('token',       data.token);
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

  function logout() {
    ['token','role','tenant_id','tenant_name','email','permissions'].forEach(k => localStorage.removeItem(k));
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
