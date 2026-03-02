import { useRef, useEffect, useId } from 'react';
import { useApp } from '../context/AppContext';

export function Card({ children, style = {} }) {
  const { theme } = useApp();
  return (
    <div style={{
      background: theme.bgCard,
      borderRadius: '12px',
      padding: '16px',
      boxShadow: theme.shadow,
      border: `1px solid ${theme.borderLight}`,
      ...style,
    }}>
      {children}
    </div>
  );
}

export function SummaryCard({ icon, label, value, color, style = {} }) {
  const { theme } = useApp();
  return (
    <div
      role="status"
      aria-label={`${label}: ${value}`}
      style={{
        background: theme.bgCard,
        borderRadius: '12px',
        padding: '14px 16px',
        boxShadow: theme.shadow,
        border: `1px solid ${theme.borderLight}`,
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        minWidth: '140px',
        flex: '1 1 140px',
        ...style,
      }}
    >
      <span style={{ fontSize: '24px' }} aria-hidden="true">{icon}</span>
      <div>
        <div style={{ fontSize: '20px', fontWeight: '700', color: color || theme.text, fontFamily: "'DM Serif Display', serif" }}>{value}</div>
        <div style={{ fontSize: '11px', color: theme.textMuted, fontFamily: "'Libre Franklin', sans-serif" }}>{label}</div>
      </div>
    </div>
  );
}

export function Button({ children, onClick, variant = 'primary', style = {}, ...props }) {
  const { theme } = useApp();
  const variants = {
    primary: { background: theme.accent, color: '#fff', border: 'none' },
    secondary: { background: 'transparent', color: theme.accent, border: `1px solid ${theme.accent}` },
    danger: { background: theme.error, color: '#fff', border: 'none' },
    ghost: { background: 'transparent', color: theme.textSecondary, border: `1px solid ${theme.border}` },
  };
  return (
    <button
      onClick={onClick}
      style={{
        fontFamily: "'Libre Franklin', sans-serif",
        fontSize: '13px',
        fontWeight: '500',
        padding: '8px 16px',
        borderRadius: '8px',
        cursor: 'pointer',
        transition: 'all 0.2s',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        ...variants[variant],
        ...style,
      }}
      {...props}
    >
      {children}
    </button>
  );
}

export function Modal({ open, onClose, title, children, width = '500px' }) {
  const { theme } = useApp();
  const dialogRef = useRef(null);
  const titleId = useId();

  useEffect(() => {
    if (!open || !dialogRef.current) return;
    const dialog = dialogRef.current;
    const focusable = dialog.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (focusable.length > 0) focusable[0].focus();

    const trapFocus = (e) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab' || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    dialog.addEventListener('keydown', trapFocus);
    return () => dialog.removeEventListener('keydown', trapFocus);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '16px',
        outline: 'none',
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={e => e.stopPropagation()}
        style={{
          background: theme.bgModal,
          borderRadius: '16px',
          padding: '24px',
          width: '100%',
          maxWidth: `min(${width}, calc(100vw - 32px))`,
          maxHeight: '85vh',
          overflow: 'auto',
          boxShadow: theme.shadowLg,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 id={titleId} style={{ margin: 0, fontFamily: "'DM Serif Display', serif", color: theme.text, fontSize: '18px' }}>{title}</h3>
          <button onClick={onClose} aria-label="Close dialog" style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: theme.textMuted }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function FormField({ label, children, style = {} }) {
  const { theme } = useApp();
  const fieldId = useId();
  return (
    <div style={{ marginBottom: '12px', ...style }}>
      <label htmlFor={fieldId} style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: theme.textSecondary, marginBottom: '4px', fontFamily: "'Libre Franklin', sans-serif" }}>{label}</label>
      {typeof children === 'object' && children !== null && children.type
        ? { ...children, props: { ...children.props, id: fieldId } }
        : children}
    </div>
  );
}

export function Input({ style = {}, ...props }) {
  const { theme } = useApp();
  return (
    <input
      style={{
        width: '100%',
        padding: '8px 12px',
        borderRadius: '8px',
        border: `1px solid ${theme.border}`,
        background: theme.bgInput,
        color: theme.text,
        fontSize: '14px',
        fontFamily: "'Libre Franklin', sans-serif",
        outline: 'none',
        boxSizing: 'border-box',
        ...style,
      }}
      {...props}
    />
  );
}

export function Select({ style = {}, children, ...props }) {
  const { theme } = useApp();
  return (
    <select
      style={{
        width: '100%',
        padding: '8px 12px',
        borderRadius: '8px',
        border: `1px solid ${theme.border}`,
        background: theme.bgInput,
        color: theme.text,
        fontSize: '14px',
        fontFamily: "'Libre Franklin', sans-serif",
        outline: 'none',
        boxSizing: 'border-box',
        ...style,
      }}
      {...props}
    >
      {children}
    </select>
  );
}

export function Badge({ children, color, bg, style = {} }) {
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: '10px',
      fontSize: '11px',
      fontWeight: '600',
      color: color || '#fff',
      background: bg || '#888',
      fontFamily: "'Libre Franklin', sans-serif",
      ...style,
    }}>
      {children}
    </span>
  );
}

export function EmptyState({ icon, message }) {
  const { theme } = useApp();
  return (
    <div style={{ textAlign: 'center', padding: '40px 20px', color: theme.textMuted }}>
      <div style={{ fontSize: '48px', marginBottom: '12px' }}>{icon}</div>
      <p style={{ fontSize: '14px', fontFamily: "'Libre Franklin', sans-serif" }}>{message}</p>
    </div>
  );
}
