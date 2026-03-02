import { useApp } from '../context/AppContext';
import { getTrialDaysRemaining, isSubscriptionActive } from '../utils/auth';
import { TRIAL_DAYS } from '../data/promoCodes';

export default function SubscriptionBanner({ onUpgrade }) {
  const { user, theme } = useApp();

  if (!user || !user.subscription) return null;
  const sub = user.subscription;
  if (sub.plan === 'paid') return null;

  const daysLeft = getTrialDaysRemaining(sub.trialEndDate);
  const expired = daysLeft <= 0;
  const warning = daysLeft > 0 && daysLeft <= 7;

  if (!expired && !warning) return null;

  const bg = expired ? '#fef2f2' : '#fffbeb';
  const border = expired ? '#fecaca' : '#fef3c7';
  const color = expired ? '#991b1b' : '#92400e';
  const icon = expired ? '🚫' : '⏳';
  const msg = expired
    ? 'Your free trial has expired. Upgrade to continue using BioGrow.'
    : `Your free trial expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}. Upgrade now to keep your data.`;

  return (
    <div style={{
      background: bg,
      borderBottom: `1px solid ${border}`,
      padding: '8px 20px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '12px',
      fontSize: '13px',
      fontFamily: "'Libre Franklin', sans-serif",
      color,
      flexWrap: 'wrap',
    }}>
      <span>{icon} {msg}</span>
      <button
        onClick={onUpgrade}
        style={{
          padding: '5px 14px',
          borderRadius: '8px',
          border: 'none',
          background: expired ? '#dc2626' : '#d97706',
          color: '#fff',
          fontSize: '12px',
          fontWeight: '600',
          cursor: 'pointer',
          fontFamily: "'Libre Franklin', sans-serif",
        }}
      >
        Upgrade Now
      </button>
    </div>
  );
}
