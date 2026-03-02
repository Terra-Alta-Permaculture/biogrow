import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Modal, Button } from './shared';
import { getAvatarEmoji } from '../utils/auth';

export default function Header({ onProfileClick, onShowGuide }) {
  const { theme, darkMode, setDarkMode, saveStatus, manualSave, exportData, importData, validateImport, showToast, user, syncStatus, syncNow } = useApp();
  const [importPreview, setImportPreview] = useState(null);

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const result = validateImport(ev.target.result);
        setImportPreview(result);
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const confirmImport = () => {
    if (!importPreview?.data) return;
    const ok = importData(importPreview.data);
    setImportPreview(null);
    if (ok) {
      showToast('Data imported successfully. Previous data backed up.', { type: 'success' });
    } else {
      showToast('Import failed — please try again', { type: 'error' });
    }
  };

  const previewRow = (label, count) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${theme.borderLight}`, fontSize: '13px' }}>
      <span style={{ color: theme.textSecondary }}>{label}</span>
      <span style={{ color: theme.text, fontWeight: '600' }}>{count}</span>
    </div>
  );

  return (
    <>
    <header style={{
      position: 'sticky',
      top: 0,
      zIndex: 100,
      background: theme.bgHeader,
      padding: '12px 20px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: '8px',
      boxShadow: '0 2px 12px rgba(0,0,0,0.2)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ fontSize: '28px' }}>🌱</span>
        <h1 style={{
          margin: 0,
          fontFamily: "'DM Serif Display', serif",
          fontSize: '24px',
          color: theme.textOnHeader,
          letterSpacing: '0.5px',
        }}>
          BioGrow
        </h1>
        <span style={{
          fontSize: '11px',
          color: 'rgba(255,255,255,0.7)',
          fontFamily: "'Libre Franklin', sans-serif",
          marginTop: '4px',
        }}>
          Market Garden Planner
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 10px',
          borderRadius: '12px',
          background: 'rgba(255,255,255,0.15)',
          fontSize: '12px',
          color: theme.textOnHeader,
        }}>
          <span style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: saveStatus === 'saved' ? '#66bb6a' : '#ffa726',
            display: 'inline-block',
          }} />
          {saveStatus === 'saved' ? 'Saved' : 'Saving...'}
        </div>
        {syncNow && (
          <button
            onClick={syncNow}
            title={syncStatus.error ? `Sync error: ${syncStatus.error}` : syncStatus.syncing ? 'Syncing...' : syncStatus.lastSynced ? `Last synced: ${new Date(syncStatus.lastSynced).toLocaleTimeString()}` : 'Sync now'}
            aria-label="Sync data"
            style={{
              ...btnStyle(theme),
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '12px',
              padding: '4px 10px',
            }}
          >
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: syncStatus.error ? '#ef5350' : syncStatus.syncing ? '#ffa726' : '#66bb6a',
              display: 'inline-block',
            }} />
            {syncStatus.syncing ? 'Syncing' : 'Sync'}
          </button>
        )}
        {user && (
          <button
            onClick={onProfileClick}
            title={user.profile?.name || user.email}
            aria-label={`Profile: ${user.profile?.name || user.email}`}
            style={{
              background: 'rgba(255,255,255,0.2)',
              border: '2px solid rgba(255,255,255,0.4)',
              borderRadius: '50%',
              width: '34px',
              height: '34px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: '18px',
              padding: 0,
              transition: 'all 0.2s',
            }}
          >
            {getAvatarEmoji(user.profile?.avatar)}
          </button>
        )}
        <button onClick={manualSave} title="Save" aria-label="Save data" style={btnStyle(theme)}>💾</button>
        <button onClick={exportData} title="Export" aria-label="Export data" style={btnStyle(theme)}>📤</button>
        <button onClick={handleImport} title="Import" aria-label="Import data" style={btnStyle(theme)}>📂</button>
        <button
          onClick={() => setDarkMode(!darkMode)}
          title={darkMode ? 'Light mode' : 'Dark mode'}
          aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          style={btnStyle(theme)}
        >
          {darkMode ? '☀️' : '🌙'}
        </button>
        {onShowGuide && (
          <button onClick={onShowGuide} title="Workflow Guide" aria-label="Open workflow guide" style={btnStyle(theme)}>❓</button>
        )}
      </div>
    </header>

    {/* Import Preview Modal */}
    <Modal open={!!importPreview} onClose={() => setImportPreview(null)} title="Import Data" width="450px">
      {importPreview && (
        <div>
          {importPreview.errors.length > 0 && (
            <div style={{ padding: '10px 14px', background: '#fef2f2', borderRadius: '8px', marginBottom: '14px', fontSize: '13px', color: '#991b1b' }}>
              {importPreview.errors.map((err, i) => <div key={i}>&#x26A0;&#xFE0F; {err}</div>)}
            </div>
          )}
          {importPreview.preview && (
            <div style={{ marginBottom: '14px' }}>
              <div style={{ fontSize: '12px', fontWeight: '600', color: theme.textSecondary, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                File Contents
              </div>
              {previewRow('Zones', importPreview.preview.zones)}
              {previewRow('Beds', importPreview.preview.beds)}
              {previewRow('Crops', importPreview.preview.crops)}
              {previewRow('Tasks', importPreview.preview.tasks)}
              {previewRow('Harvests', importPreview.preview.harvests)}
              {previewRow('Events', importPreview.preview.events)}
            </div>
          )}
          <div style={{ padding: '10px 14px', background: theme.bgHover, borderRadius: '8px', marginBottom: '16px', fontSize: '12px', color: theme.textSecondary, lineHeight: '1.6' }}>
            &#x26A0;&#xFE0F; This will <strong>replace</strong> your current data. Your existing data will be automatically backed up first.
          </div>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <Button variant="ghost" onClick={() => setImportPreview(null)}>Cancel</Button>
            <Button onClick={confirmImport} disabled={!importPreview.valid}>
              {importPreview.valid ? 'Import Data' : 'Cannot Import'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
    </>
  );
}

const btnStyle = (theme) => ({
  background: 'rgba(255,255,255,0.15)',
  border: '1px solid rgba(255,255,255,0.2)',
  borderRadius: '8px',
  padding: '6px 10px',
  cursor: 'pointer',
  fontSize: '16px',
  color: theme.textOnHeader,
  transition: 'all 0.2s',
});
