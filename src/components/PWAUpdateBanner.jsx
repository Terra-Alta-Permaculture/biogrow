import { useRegisterSW } from 'virtual:pwa-register/react';
import { useApp } from '../context/AppContext';

export default function PWAUpdateBanner() {
  const { theme } = useApp();
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '16px',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 1100,
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '12px 20px',
      borderRadius: '12px',
      background: theme.accent,
      color: '#fff',
      fontSize: '14px',
      fontFamily: "'Libre Franklin', sans-serif",
      fontWeight: '500',
      boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
      maxWidth: '90vw',
    }}>
      <span>🌱 New version available</span>
      <button
        onClick={() => updateServiceWorker(true)}
        style={{
          padding: '6px 14px',
          borderRadius: '8px',
          border: 'none',
          background: 'rgba(255,255,255,0.2)',
          color: '#fff',
          fontSize: '13px',
          fontWeight: '700',
          cursor: 'pointer',
          fontFamily: "'Libre Franklin', sans-serif",
          whiteSpace: 'nowrap',
        }}
      >
        Refresh
      </button>
    </div>
  );
}
