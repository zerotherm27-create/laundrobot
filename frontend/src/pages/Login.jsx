import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(email, password);
    } catch {
      setError('Invalid email or password.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#f5f5f3'
    }}>
      <div style={{
        background: '#fff',
        borderRadius: 16,
        border: '0.5px solid #e0e0d8',
        padding: '2.5rem',
        width: 360
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '2rem' }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: '#378ADD', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 500, fontSize: 20
          }}>L</div>
          <div>
            <div style={{ fontWeight: 500, fontSize: 16 }}>LaundroBot</div>
            <div style={{ fontSize: 12, color: '#888' }}>Admin Dashboard</div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 13, color: '#666', display: 'block', marginBottom: 5 }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '8px 12px', borderRadius: 8,
                border: '0.5px solid #ccc', fontSize: 14
              }}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 13, color: '#666', display: 'block', marginBottom: 5 }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '8px 12px', borderRadius: 8,
                border: '0.5px solid #ccc', fontSize: 14
              }}
            />
          </div>

          {error && (
            <div style={{ color: '#A32D2D', fontSize: 13, marginBottom: 14 }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '10px', borderRadius: 8,
              background: loading ? '#aaa' : '#378ADD',
              color: '#fff', border: 'none',
              fontWeight: 500, fontSize: 14, cursor: 'pointer'
            }}
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}