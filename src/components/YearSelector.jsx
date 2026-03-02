import { useApp } from '../context/AppContext';

export default function YearSelector({ value, onChange }) {
  const { theme } = useApp();
  const headingFont = "'DM Serif Display', serif";
  const currentYear = new Date().getFullYear();
  const minYear = 2020;
  const maxYear = currentYear + 5;

  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '2px',
      background: theme.bgHover || theme.bg,
      borderRadius: '8px',
      border: `1px solid ${theme.borderLight}`,
      padding: '2px 4px',
    }}>
      <button
        onClick={() => value > minYear && onChange(value - 1)}
        disabled={value <= minYear}
        style={{
          background: 'none', border: 'none', cursor: value > minYear ? 'pointer' : 'default',
          color: value > minYear ? theme.textSecondary : theme.borderLight,
          fontSize: '14px', padding: '2px 6px', lineHeight: 1, fontWeight: '700',
          display: 'flex', alignItems: 'center',
        }}
      >
        &lsaquo;
      </button>
      <span style={{
        fontFamily: headingFont,
        fontSize: '15px',
        fontWeight: '700',
        color: theme.text,
        minWidth: '42px',
        textAlign: 'center',
        userSelect: 'none',
      }}>
        {value}
      </span>
      <button
        onClick={() => value < maxYear && onChange(value + 1)}
        disabled={value >= maxYear}
        style={{
          background: 'none', border: 'none', cursor: value < maxYear ? 'pointer' : 'default',
          color: value < maxYear ? theme.textSecondary : theme.borderLight,
          fontSize: '14px', padding: '2px 6px', lineHeight: 1, fontWeight: '700',
          display: 'flex', alignItems: 'center',
        }}
      >
        &rsaquo;
      </button>
    </div>
  );
}
