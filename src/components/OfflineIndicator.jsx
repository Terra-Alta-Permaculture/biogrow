import { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';

export default function OfflineIndicator() {
  const { theme } = useApp();
  const [offline, setOffline] = useState(!navigator.onLine);
  const [showBackOnline, setShowBackOnline] = useState(false);
  const wasOffline = useRef(false);

  useEffect(() => {
    const handleOffline = () => {
      setOffline(true);
      wasOffline.current = true;
    };

    const handleOnline = () => {
      setOffline(false);
      if (wasOffline.current) {
        setShowBackOnline(true);
        wasOffline.current = false;
        setTimeout(() => setShowBackOnline(false), 3000);
      }
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  if (!offline && !showBackOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        width: '100%',
        padding: '8px 16px',
        textAlign: 'center',
        fontSize: '13px',
        fontFamily: "'Libre Franklin', sans-serif",
        fontWeight: '600',
        background: offline ? theme.warning || '#f57c00' : theme.success || '#388e3c',
        color: '#fff',
        transition: 'background 0.3s ease',
      }}
    >
      {offline
        ? '📡 You\'re offline — changes will sync when reconnected'
        : '✅ Back online'
      }
    </div>
  );
}
