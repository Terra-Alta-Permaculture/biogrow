import { AVATARS } from '../utils/auth';

export default function AvatarPicker({ value, onChange, theme }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(6, 1fr)',
      gap: '8px',
      padding: '4px',
    }}>
      {AVATARS.map(av => (
        <button
          key={av.id}
          onClick={() => onChange(av.id)}
          title={av.label}
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            border: value === av.id ? `3px solid ${theme.accent}` : `2px solid ${theme.borderLight}`,
            background: value === av.id ? `${theme.accent}15` : theme.bgInput,
            cursor: 'pointer',
            fontSize: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s',
            transform: value === av.id ? 'scale(1.1)' : 'scale(1)',
            padding: 0,
          }}
        >
          {av.emoji}
        </button>
      ))}
    </div>
  );
}
