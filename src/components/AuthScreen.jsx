import { useState } from 'react';
import { useApp } from '../context/AppContext';

export default function AuthScreen() {
  const { theme, login, register, darkMode, setDarkMode } = useApp();
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [name, setName] = useState('');
  const [farmName, setFarmName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignIn = async (e) => {
    e.preventDefault();
    setError('');
    if (!email || !password) { setError('Please fill in all fields'); return; }
    setLoading(true);
    const result = await login(email, password);
    setLoading(false);
    if (!result.success) setError(result.error);
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    setError('');
    if (!name || !email || !password) { setError('Please fill in all required fields'); return; }
    if (password !== confirmPw) { setError('Passwords do not match'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    setLoading(true);
    const result = await register({ email, password, name, farmName });
    setLoading(false);
    if (!result.success) setError(result.error);
  };

  const inputStyle = {
    width: '100%',
    padding: '12px 14px',
    borderRadius: '10px',
    border: `1.5px solid ${theme.border}`,
    background: theme.bgInput,
    color: theme.text,
    fontSize: '14px',
    fontFamily: "'Libre Franklin', sans-serif",
    outline: 'none',
    transition: 'border-color 0.2s',
    boxSizing: 'border-box',
  };

  const labelStyle = {
    display: 'block',
    fontSize: '12px',
    fontWeight: '600',
    color: theme.textSecondary,
    marginBottom: '6px',
    fontFamily: "'Libre Franklin', sans-serif",
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: theme.bg,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Libre Franklin', sans-serif",
    }}>
      <div style={{
        display: 'flex',
        maxWidth: '900px',
        width: '100%',
        margin: '20px',
        borderRadius: '20px',
        overflow: 'hidden',
        boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
        background: theme.bgCard,
        minHeight: '540px',
      }}>
        {/* Left branding panel */}
        <div style={{
          flex: '1 1 380px',
          background: 'linear-gradient(135deg, #5d4e37 0%, #3e6b48 100%)',
          padding: '48px 36px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          color: '#fff',
        }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>🌱</div>
          <h1 style={{
            fontFamily: "'DM Serif Display', serif",
            fontSize: '36px',
            marginBottom: '8px',
            letterSpacing: '0.5px',
          }}>BioGrow</h1>
          <p style={{ fontSize: '14px', opacity: 0.8, marginBottom: '32px' }}>
            Bio-Intensive Market Garden Planner
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {[
              { icon: '🗺️', text: 'Plan beds & zones with interactive maps' },
              { icon: '📅', text: 'Season-by-season planting schedules' },
              { icon: '🔄', text: 'Crop rotation & companion tracking' },
              { icon: '🍽️', text: 'Farm-to-table event planning' },
              { icon: '🌤️', text: 'Weather & irrigation management' },
            ].map(f => (
              <div key={f.text} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' }}>
                <span style={{ fontSize: '18px' }}>{f.icon}</span>
                <span style={{ opacity: 0.9 }}>{f.text}</span>
              </div>
            ))}
          </div>
          <div style={{
            marginTop: '32px',
            padding: '10px 16px',
            background: 'rgba(255,255,255,0.15)',
            borderRadius: '10px',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <span style={{ fontSize: '18px' }}>🎁</span>
            <span>30-day free trial — no credit card required</span>
          </div>
        </div>

        {/* Right form panel */}
        <div style={{
          flex: '1 1 420px',
          padding: '40px 36px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}>
          {/* Tab toggle */}
          <div style={{
            display: 'flex',
            background: theme.bgHover,
            borderRadius: '10px',
            padding: '4px',
            marginBottom: '28px',
          }}>
            {['signin', 'signup'].map(m => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(''); }}
                style={{
                  flex: 1,
                  padding: '10px',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontFamily: "'Libre Franklin', sans-serif",
                  fontSize: '13px',
                  fontWeight: '600',
                  background: mode === m ? theme.bgCard : 'transparent',
                  color: mode === m ? theme.accent : theme.textSecondary,
                  boxShadow: mode === m ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
                  transition: 'all 0.2s',
                }}
              >
                {m === 'signin' ? 'Sign In' : 'Create Account'}
              </button>
            ))}
          </div>

          {error && (
            <div style={{
              padding: '10px 14px',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '8px',
              color: '#991b1b',
              fontSize: '13px',
              marginBottom: '16px',
            }}>
              {error}
            </div>
          )}

          <form onSubmit={mode === 'signin' ? handleSignIn : handleSignUp}>
            {mode === 'signup' && (
              <>
                <div style={{ marginBottom: '14px' }}>
                  <label style={labelStyle}>Name *</label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Your name"
                    style={inputStyle}
                  />
                </div>
                <div style={{ marginBottom: '14px' }}>
                  <label style={labelStyle}>Farm Name</label>
                  <input
                    type="text"
                    value={farmName}
                    onChange={e => setFarmName(e.target.value)}
                    placeholder="e.g. Quinta da Horta"
                    style={inputStyle}
                  />
                </div>
              </>
            )}

            <div style={{ marginBottom: '14px' }}>
              <label style={labelStyle}>Email *</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="farmer@example.com"
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={labelStyle}>Password *</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={mode === 'signup' ? 'At least 6 characters' : 'Your password'}
                style={inputStyle}
              />
            </div>

            {mode === 'signup' && (
              <div style={{ marginBottom: '14px' }}>
                <label style={labelStyle}>Confirm Password *</label>
                <input
                  type="password"
                  value={confirmPw}
                  onChange={e => setConfirmPw(e.target.value)}
                  placeholder="Repeat password"
                  style={inputStyle}
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '13px',
                border: 'none',
                borderRadius: '10px',
                background: loading ? theme.textMuted : 'linear-gradient(135deg, #5d4e37, #3e6b48)',
                color: '#fff',
                fontSize: '14px',
                fontWeight: '600',
                cursor: loading ? 'wait' : 'pointer',
                fontFamily: "'Libre Franklin', sans-serif",
                marginTop: '8px',
                transition: 'opacity 0.2s',
              }}
            >
              {loading ? 'Please wait...' : mode === 'signin' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          {/* Footer with dark mode toggle */}
          <div style={{
            marginTop: '24px',
            textAlign: 'center',
            fontSize: '12px',
            color: theme.textMuted,
          }}>
            <button
              onClick={() => setDarkMode(!darkMode)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '12px',
                color: theme.textMuted,
              }}
            >
              {darkMode ? '☀️ Light mode' : '🌙 Dark mode'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
