import { useApp } from '../context/AppContext';

export default function ToastContainer() {
  const { toasts, dismissToast, theme } = useApp();
  if (!toasts || toasts.length === 0) return null;

  const typeColors = {
    success: '#16a34a',
    info: '#2563eb',
    warning: '#d97706',
    error: '#dc2626',
  };

  return (
    <div style={{
      position: 'fixed',
      bottom: '24px',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 2000,
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      maxWidth: 'calc(100vw - 32px)',
      width: '380px',
    }}>
      {toasts.map(toast => (
        <div
          key={toast.id}
          style={{
            background: theme.bgCard,
            borderRadius: '10px',
            padding: '12px 16px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.18)',
            borderLeft: `4px solid ${typeColors[toast.type] || typeColors.info}`,
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            animation: 'toastSlideIn 0.25s ease-out',
            fontSize: '13px',
            fontFamily: "'Libre Franklin', sans-serif",
            color: theme.text,
          }}
        >
          <span style={{ flex: 1 }}>{toast.message}</span>
          {toast.undo && (
            <button
              onClick={() => { toast.undo(); dismissToast(toast.id); }}
              style={{
                background: 'none',
                border: 'none',
                color: typeColors[toast.type] || typeColors.info,
                fontWeight: '700',
                fontSize: '13px',
                cursor: 'pointer',
                padding: '4px 8px',
                borderRadius: '6px',
                fontFamily: "'Libre Franklin', sans-serif",
                whiteSpace: 'nowrap',
              }}
            >
              Undo
            </button>
          )}
          <button
            onClick={() => dismissToast(toast.id)}
            style={{
              background: 'none',
              border: 'none',
              color: theme.textMuted,
              fontSize: '16px',
              cursor: 'pointer',
              padding: '0 2px',
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>
      ))}
      <style>{`
        @keyframes toastSlideIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
