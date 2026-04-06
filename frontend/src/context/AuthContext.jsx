import { createContext, useContext, useState } from 'react';
import { login as apiLogin } from '../api.js';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const token = localStorage.getItem('token');
      const role = localStorage.getItem('role');
      const tenant_id = localStorage.getItem('tenant_id');
      const tenant_name = localStorage.getItem('tenant_name');
      const email = localStorage.getItem('email');
      if (!token) return null;
      return { token, role, tenant_id, tenant_name, email };
    } catch {
      return null;
    }
  });

  async function login(email, password) {
    try {
      const { data } = await apiLogin(email, password);
      localStorage.setItem('token', data.token);
      localStorage.setItem('role', data.role);
      localStorage.setItem('tenant_id', data.tenant_id || '');
      localStorage.setItem('tenant_name', data.tenant_name || '');
      localStorage.setItem('email', data.email || email);
      setUser({
        token: data.token,
        role: data.role,
        tenant_id: data.tenant_id,
        tenant_name: data.tenant_name,
        email: data.email || email,
      });
    } catch (err) {
      throw err;
    }
  }

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('tenant_id');
    localStorage.removeItem('tenant_name');
    localStorage.removeItem('email');
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