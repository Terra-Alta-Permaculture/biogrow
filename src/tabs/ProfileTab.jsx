import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Card, Button, Modal, FormField, Input, Select, Badge } from '../components/shared';
import AvatarPicker from '../components/AvatarPicker';
import UpgradeModal from '../components/UpgradeModal';
import { getAvatarEmoji, getTrialDaysRemaining, isSubscriptionActive, GROWING_PHILOSOPHIES } from '../utils/auth';
import { TRIAL_DAYS, BASE_PRICE } from '../data/promoCodes';
import { getBackupInfo, loadBackup } from '../utils/indexedDB';

export default function ProfileTab() {
  const { user, updateUserProfile, updateSubscription, logout, exportData, importData, showToast, theme } = useApp();
  const [editModal, setEditModal] = useState(false);
  const [upgradeModal, setUpgradeModal] = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [backupInfo, setBackupInfo] = useState(null);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    getBackupInfo().then(info => setBackupInfo(info));
  }, []);

  if (!user) return null;

  const profile = user.profile || {};
  const sub = user.subscription || {};
  const daysLeft = getTrialDaysRemaining(sub.trialEndDate);
  const active = isSubscriptionActive(sub);
  const trialProgress = sub.plan === 'trial' ? Math.max(0, Math.min(100, ((TRIAL_DAYS - daysLeft) / TRIAL_DAYS) * 100)) : 0;

  const openEdit = () => {
    setEditForm({ ...profile });
    setEditModal(true);
  };

  const saveEdit = () => {
    updateUserProfile(editForm);
    setEditModal(false);
  };

  const handleDelete = () => {
    localStorage.removeItem('biogrow-auth');
    localStorage.removeItem('biogrow-data');
    logout();
  };

  const sectionTitle = (text) => (
    <h3 style={{ margin: '0 0 16px', fontFamily: "'DM Serif Display', serif", color: theme.text, fontSize: '18px' }}>{text}</h3>
  );

  const fieldRow = (label, value) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${theme.borderLight}`, fontSize: '13px' }}>
      <span style={{ color: theme.textSecondary, fontWeight: '500' }}>{label}</span>
      <span style={{ color: theme.text }}>{value || '—'}</span>
    </div>
  );

  const philo = GROWING_PHILOSOPHIES.find(g => g.value === profile.growingPhilosophy);

  // Storage computation
  const storageRaw = localStorage.getItem('biogrow-data');
  const storageSizeBytes = storageRaw ? new Blob([storageRaw]).size : 0;
  const storageSizeMB = (storageSizeBytes / (1024 * 1024)).toFixed(2);
  const maxMB = 5;
  const storagePercent = Math.min(100, (storageSizeBytes / (maxMB * 1024 * 1024)) * 100);
  const storageColor = storagePercent > 80 ? '#dc2626' : storagePercent > 60 ? '#d97706' : '#16a34a';
  const lastBackupStr = localStorage.getItem('biogrow-lastBackup');
  const lastBackupDate = lastBackupStr ? new Date(parseInt(lastBackupStr)) : (backupInfo?.timestamp ? new Date(backupInfo.timestamp) : null);

  const handleRestore = async () => {
    setRestoring(true);
    try {
      const backup = await loadBackup();
      if (backup?.data) {
        importData(backup.data);
        showToast('Data restored from backup', { type: 'success' });
      } else {
        showToast('No backup found', { type: 'warning' });
      }
    } catch {
      showToast('Restore failed', { type: 'error' });
    }
    setRestoring(false);
  };

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <h2 style={{ margin: 0, fontFamily: "'DM Serif Display', serif", color: theme.text }}>👤 Profile</h2>
        <Button onClick={openEdit}>Edit Profile</Button>
      </div>

      {/* Profile Card */}
      <Card style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
          <div style={{
            width: '72px',
            height: '72px',
            borderRadius: '50%',
            background: `${theme.accent}15`,
            border: `3px solid ${theme.accent}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '36px',
            flexShrink: 0,
          }}>
            {getAvatarEmoji(profile.avatar)}
          </div>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <h3 style={{ margin: '0 0 4px', fontFamily: "'DM Serif Display', serif", color: theme.text, fontSize: '22px' }}>
              {profile.name || 'Unnamed Farmer'}
            </h3>
            <div style={{ fontSize: '13px', color: theme.textSecondary, marginBottom: '4px' }}>{user.email}</div>
            {profile.farmName && (
              <div style={{ fontSize: '13px', color: theme.textSecondary }}>🌿 {profile.farmName}</div>
            )}
          </div>
          <div>
            <Badge
              bg={sub.plan === 'paid' ? '#16a34a' : active ? theme.accent : '#dc2626'}
              color="#fff"
            >
              {sub.plan === 'paid' ? '✅ Premium' : active ? `Trial · ${daysLeft}d left` : 'Trial Expired'}
            </Badge>
          </div>
        </div>
      </Card>

      {/* Farm Details */}
      <Card style={{ marginBottom: '20px' }}>
        {sectionTitle('🌾 Farm Details')}
        {fieldRow('Farm Name', profile.farmName)}
        {fieldRow('Location', profile.location)}
        {fieldRow('Farm Size', profile.farmSize)}
        {fieldRow('Growing Philosophy', philo ? `${philo.icon} ${philo.label}` : '—')}
        {profile.bio && (
          <div style={{ marginTop: '12px', padding: '12px', background: theme.bgHover, borderRadius: '8px', fontSize: '13px', color: theme.text, lineHeight: '1.5' }}>
            {profile.bio}
          </div>
        )}
      </Card>

      {/* Subscription */}
      <Card style={{ marginBottom: '20px' }}>
        {sectionTitle('📋 Subscription')}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <Badge bg={sub.plan === 'paid' ? '#16a34a' : theme.accent} color="#fff">
            {sub.plan === 'paid' ? 'Premium' : 'Free Trial'}
          </Badge>
          {sub.plan === 'paid' ? (
            <span style={{ fontSize: '13px', color: '#16a34a', fontWeight: '600' }}>✅ Active — Full Access</span>
          ) : active ? (
            <span style={{ fontSize: '13px', color: theme.accent, fontWeight: '600' }}>
              {daysLeft} of {TRIAL_DAYS} days remaining
            </span>
          ) : (
            <span style={{ fontSize: '13px', color: '#dc2626', fontWeight: '600' }}>Expired</span>
          )}
        </div>

        {sub.plan === 'trial' && (
          <div style={{ marginBottom: '16px' }}>
            <div style={{
              height: '8px',
              borderRadius: '4px',
              background: theme.bgHover,
              overflow: 'hidden',
            }}>
              <div style={{
                height: '100%',
                width: `${trialProgress}%`,
                borderRadius: '4px',
                background: daysLeft <= 7 ? (daysLeft <= 0 ? '#dc2626' : '#d97706') : theme.accent,
                transition: 'width 0.3s',
              }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '11px', color: theme.textMuted }}>
              <span>Day {TRIAL_DAYS - daysLeft}</span>
              <span>Day {TRIAL_DAYS}</span>
            </div>
          </div>
        )}

        {sub.promoCode && (
          <div style={{
            padding: '8px 12px',
            background: '#f0fdf4',
            borderRadius: '8px',
            fontSize: '12px',
            color: '#16a34a',
            marginBottom: '16px',
          }}>
            ✅ Promo code <strong>{sub.promoCode}</strong> applied — {(sub.promoDiscount * 100).toFixed(0)}% discount
          </div>
        )}

        {sub.plan !== 'paid' && (
          <Button onClick={() => setUpgradeModal(true)}>
            Upgrade Now — €{(BASE_PRICE * (1 - (sub.promoDiscount || 0))).toFixed(2)}
          </Button>
        )}
      </Card>

      {/* Data & Storage */}
      <Card style={{ marginBottom: '20px' }}>
        {sectionTitle('💾 Data & Storage')}
        <div style={{ marginBottom: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px' }}>
            <span style={{ color: theme.textSecondary }}>Local Storage</span>
            <span style={{ color: theme.text, fontWeight: '600' }}>{storageSizeMB} MB of ~{maxMB} MB</span>
          </div>
          <div style={{ height: '8px', borderRadius: '4px', background: theme.bgHover, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${storagePercent}%`,
              borderRadius: '4px',
              background: storageColor,
              transition: 'width 0.3s',
            }} />
          </div>
        </div>
        <div style={{ fontSize: '13px', color: theme.textSecondary, marginBottom: '14px' }}>
          {lastBackupDate ? (
            <span>Last auto-backup: <strong style={{ color: theme.text }}>{lastBackupDate.toLocaleDateString()} {lastBackupDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong></span>
          ) : (
            <span>No backup yet — backups are created automatically when you save.</span>
          )}
        </div>
        {backupInfo && (
          <Button variant="secondary" onClick={handleRestore} disabled={restoring}>
            {restoring ? 'Restoring...' : '🔄 Restore from Backup'}
          </Button>
        )}
      </Card>

      {/* Account Actions */}
      <Card>
        {sectionTitle('⚙️ Account')}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <Button variant="secondary" onClick={exportData}>📤 Export My Data</Button>
          <Button variant="ghost" onClick={logout}>🚪 Sign Out</Button>
          <button
            onClick={() => setDeleteModal(true)}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: `1px solid #fecaca`,
              background: '#fef2f2',
              color: '#dc2626',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              fontFamily: "'Libre Franklin', sans-serif",
            }}
          >
            🗑️ Delete Account
          </button>
        </div>
      </Card>

      {/* Edit Profile Modal */}
      <Modal open={editModal} onClose={() => setEditModal(false)} title="Edit Profile" width="500px">
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: theme.textSecondary, marginBottom: '8px' }}>Avatar</label>
          <AvatarPicker value={editForm.avatar} onChange={v => setEditForm({ ...editForm, avatar: v })} theme={theme} />
        </div>
        <FormField label="Name">
          <Input value={editForm.name || ''} onChange={e => setEditForm({ ...editForm, name: e.target.value })} placeholder="Your name" />
        </FormField>
        <FormField label="Farm Name">
          <Input value={editForm.farmName || ''} onChange={e => setEditForm({ ...editForm, farmName: e.target.value })} placeholder="e.g. Quinta da Horta" />
        </FormField>
        <div style={{ display: 'flex', gap: '12px' }}>
          <FormField label="Location" style={{ flex: 1 }}>
            <Input value={editForm.location || ''} onChange={e => setEditForm({ ...editForm, location: e.target.value })} placeholder="e.g. Sintra, Portugal" />
          </FormField>
          <FormField label="Farm Size" style={{ flex: 1 }}>
            <Input value={editForm.farmSize || ''} onChange={e => setEditForm({ ...editForm, farmSize: e.target.value })} placeholder="e.g. 0.5 hectares" />
          </FormField>
        </div>
        <FormField label="Growing Philosophy">
          <Select value={editForm.growingPhilosophy || 'biointensive'} onChange={e => setEditForm({ ...editForm, growingPhilosophy: e.target.value })}>
            {GROWING_PHILOSOPHIES.map(g => (
              <option key={g.value} value={g.value}>{g.icon} {g.label}</option>
            ))}
          </Select>
        </FormField>
        <FormField label="Bio">
          <textarea
            value={editForm.bio || ''}
            onChange={e => setEditForm({ ...editForm, bio: e.target.value })}
            placeholder="Tell us about your farm..."
            rows={3}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: '10px',
              border: `1.5px solid ${theme.border}`,
              background: theme.bgInput,
              color: theme.text,
              fontSize: '14px',
              fontFamily: "'Libre Franklin', sans-serif",
              outline: 'none',
              resize: 'vertical',
              boxSizing: 'border-box',
            }}
          />
        </FormField>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
          <Button variant="ghost" onClick={() => setEditModal(false)}>Cancel</Button>
          <Button onClick={saveEdit}>Save Changes</Button>
        </div>
      </Modal>

      {/* Upgrade Modal */}
      <UpgradeModal open={upgradeModal} onClose={() => setUpgradeModal(false)} />

      {/* Delete Account Modal */}
      <Modal open={deleteModal} onClose={() => setDeleteModal(false)} title="Delete Account" width="400px">
        <div style={{ padding: '16px', background: '#fef2f2', borderRadius: '8px', marginBottom: '16px', textAlign: 'center' }}>
          <span style={{ fontSize: '32px' }}>⚠️</span>
          <p style={{ margin: '8px 0 0', fontSize: '14px', color: '#991b1b' }}>
            This will permanently delete your account and all farm data. This action cannot be undone.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <Button variant="ghost" onClick={() => setDeleteModal(false)}>Cancel</Button>
          <button
            onClick={handleDelete}
            style={{ padding: '8px 16px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontFamily: "'Libre Franklin', sans-serif", fontSize: '13px' }}
          >
            Delete Everything
          </button>
        </div>
      </Modal>
    </div>
  );
}
