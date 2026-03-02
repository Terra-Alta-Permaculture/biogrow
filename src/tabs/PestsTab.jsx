import { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Card, SummaryCard, Button, Modal, FormField, Input, Select, Badge, EmptyState } from '../components/shared';
import { pestDatabase } from '../data/pests';
import { generateId, formatDate } from '../utils/helpers';

const SEVERITIES = [
  { value: 'low', label: '🟢 Low', color: '#4caf50' },
  { value: 'moderate', label: '🟡 Moderate', color: '#ff9800' },
  { value: 'severe', label: '🔴 Severe', color: '#f44336' },
  { value: 'critical', label: '💀 Critical', color: '#880e4f' },
];

const STATUSES = [
  { value: 'active', label: '⚠️ Active', color: '#f44336' },
  { value: 'treating', label: '💊 Treating', color: '#ff9800' },
  { value: 'monitoring', label: '👁️ Monitoring', color: '#2196f3' },
  { value: 'resolved', label: '✅ Resolved', color: '#4caf50' },
];

export default function PestsTab() {
  const { pestLogs, zones, crops, updateState, theme } = useApp();
  const [showModal, setShowModal] = useState(false);
  const [showDb, setShowDb] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPest, setFilterPest] = useState('all');
  const [form, setForm] = useState({ pestId: pestDatabase[0]?.id || '', date: new Date().toISOString().slice(0,10), cropId: '', bedId: '', severity: 'low', status: 'active', treatment: '', notes: '' });

  const allBeds = useMemo(() => zones.flatMap(z => z.beds.map(b => ({ ...b, zoneName: z.name, zoneId: z.id }))), [zones]);
  const logs = pestLogs || [];

  const filtered = useMemo(() => {
    let l = [...logs];
    if (filterStatus !== 'all') l = l.filter(x => x.status === filterStatus);
    if (filterPest !== 'all') l = l.filter(x => x.pestId === filterPest);
    return l.sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [logs, filterStatus, filterPest]);

  const stats = useMemo(() => ({
    active: logs.filter(l => l.status === 'active').length,
    treating: logs.filter(l => l.status === 'treating').length,
    monitoring: logs.filter(l => l.status === 'monitoring').length,
    resolved: logs.filter(l => l.status === 'resolved').length,
  }), [logs]);

  const openAdd = () => {
    setEditing(null);
    setForm({ pestId: pestDatabase[0]?.id || '', date: new Date().toISOString().slice(0,10), cropId: crops[0]?.id || '', bedId: allBeds[0]?.id || '', severity: 'low', status: 'active', treatment: '', notes: '' });
    setShowModal(true);
  };

  const openEdit = (log) => {
    setEditing(log.id);
    setForm({ pestId: log.pestId, date: log.date, cropId: log.cropId, bedId: log.bedId, severity: log.severity, status: log.status, treatment: log.treatment || '', notes: log.notes || '' });
    setShowModal(true);
  };

  const save = () => {
    updateState(prev => {
      const list = [...(prev.pestLogs || [])];
      if (editing) {
        const idx = list.findIndex(x => x.id === editing);
        if (idx >= 0) list[idx] = { ...list[idx], ...form };
      } else {
        list.push({ id: generateId(), ...form });
      }
      return { ...prev, pestLogs: list };
    });
    setShowModal(false);
  };

  const remove = (id) => {
    updateState(prev => ({ ...prev, pestLogs: (prev.pestLogs || []).filter(x => x.id !== id) }));
    setDeleteConfirm(null);
  };

  const getPest = (id) => pestDatabase.find(p => p.id === id);
  const getCrop = (id) => crops.find(c => c.id === id);
  const getBed = (id) => allBeds.find(b => b.id === id);
  const getSev = (v) => SEVERITIES.find(s => s.value === v);
  const getStat = (v) => STATUSES.find(s => s.value === v);

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <h2 style={{ margin: 0, fontFamily: "'DM Serif Display', serif", color: theme.text }}>🐛 Pest & Disease Tracker</h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button variant="secondary" onClick={() => setShowDb(true)}>📚 Pest Database</Button>
          <Button onClick={openAdd}>+ Log Sighting</Button>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '24px' }}>
        <SummaryCard icon="⚠️" label="Active" value={stats.active} color="#f44336" />
        <SummaryCard icon="💊" label="Treating" value={stats.treating} color="#ff9800" />
        <SummaryCard icon="👁️" label="Monitoring" value={stats.monitoring} color="#2196f3" />
        <SummaryCard icon="✅" label="Resolved" value={stats.resolved} color="#4caf50" />
      </div>

      {/* Filters */}
      <Card style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: '12px', color: theme.textMuted }}>Status: </span>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ padding: '6px 10px', borderRadius: '6px', border: `1px solid ${theme.border}`, background: theme.bgInput, color: theme.text, fontSize: '13px' }}>
              <option value="all">All</option>
              {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <span style={{ fontSize: '12px', color: theme.textMuted }}>Pest: </span>
            <select value={filterPest} onChange={e => setFilterPest(e.target.value)} style={{ padding: '6px 10px', borderRadius: '6px', border: `1px solid ${theme.border}`, background: theme.bgInput, color: theme.text, fontSize: '13px' }}>
              <option value="all">All Pests</option>
              {pestDatabase.map(p => <option key={p.id} value={p.id}>{p.icon} {p.name}</option>)}
            </select>
          </div>
        </div>
      </Card>

      {/* Pest logs */}
      <Card style={{ marginBottom: '24px' }}>
        {filtered.length === 0 ? (
          <EmptyState icon="🐛" message="No pest sightings logged. That's good news!" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {filtered.map(log => {
              const pest = getPest(log.pestId);
              const crop = getCrop(log.cropId);
              const bed = getBed(log.bedId);
              const sev = getSev(log.severity);
              const stat = getStat(log.status);
              return (
                <div key={log.id} style={{ padding: '12px', borderRadius: '10px', border: `1px solid ${theme.borderLight}`, background: theme.bgHover, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '200px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '18px' }}>{pest?.icon || '🐛'}</span>
                      <strong style={{ color: theme.text, fontSize: '14px' }}>{pest?.name || log.pestId}</strong>
                      <Badge bg={sev?.color} color="#fff">{sev?.label}</Badge>
                      <Badge bg={stat?.color} color="#fff">{stat?.label}</Badge>
                    </div>
                    <div style={{ fontSize: '12px', color: theme.textSecondary, display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                      <span>📅 {formatDate(log.date)}</span>
                      {crop && <span>{crop.icon} {crop.name}</span>}
                      {bed && <span>📍 {bed.name}</span>}
                    </div>
                    {log.treatment && <div style={{ fontSize: '12px', color: theme.accent, marginTop: '4px' }}>💊 {log.treatment}</div>}
                    {log.notes && <div style={{ fontSize: '12px', color: theme.textMuted, marginTop: '2px' }}>{log.notes}</div>}
                  </div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button onClick={() => openEdit(log)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px' }}>✏️</button>
                    <button onClick={() => setDeleteConfirm(log)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px' }}>🗑️</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Delete Confirmation Modal */}
      <Modal open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Delete Pest Log?" width="400px">
        {deleteConfirm && (() => {
          const pest = getPest(deleteConfirm.pestId);
          return (
            <div>
              <p style={{ margin: '0 0 16px', color: theme.textSecondary, fontSize: '14px' }}>
                Delete <strong>{pest?.icon} {pest?.name || 'pest'}</strong> sighting from {formatDate(deleteConfirm.date)}?
              </p>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <Button variant="ghost" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
                <button onClick={() => remove(deleteConfirm.id)} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#e53935', color: '#fff', fontWeight: '600', cursor: 'pointer', fontSize: '13px' }}>Delete</button>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* Add/Edit Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Pest Log' : 'Log Pest Sighting'}>
        <FormField label="Pest / Disease">
          <Select value={form.pestId} onChange={e => setForm({ ...form, pestId: e.target.value })}>
            {pestDatabase.map(p => <option key={p.id} value={p.id}>{p.icon} {p.name}</option>)}
          </Select>
        </FormField>
        <FormField label="Date">
          <Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
        </FormField>
        <div style={{ display: 'flex', gap: '12px' }}>
          <FormField label="Affected Crop" style={{ flex: 1 }}>
            <Select value={form.cropId} onChange={e => setForm({ ...form, cropId: e.target.value })}>
              <option value="">— None —</option>
              {crops.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
            </Select>
          </FormField>
          <FormField label="Bed" style={{ flex: 1 }}>
            <Select value={form.bedId} onChange={e => setForm({ ...form, bedId: e.target.value })}>
              <option value="">— None —</option>
              {allBeds.map(b => <option key={b.id} value={b.id}>{b.name} ({b.zoneName})</option>)}
            </Select>
          </FormField>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <FormField label="Severity" style={{ flex: 1 }}>
            <Select value={form.severity} onChange={e => setForm({ ...form, severity: e.target.value })}>
              {SEVERITIES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </Select>
          </FormField>
          <FormField label="Status" style={{ flex: 1 }}>
            <Select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
              {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </Select>
          </FormField>
        </div>
        <FormField label="Treatment Applied">
          <Input value={form.treatment} onChange={e => setForm({ ...form, treatment: e.target.value })} placeholder="e.g. Neem oil spray" />
        </FormField>
        <FormField label="Notes">
          <Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Additional observations..." />
        </FormField>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
          <Button variant="ghost" onClick={() => setShowModal(false)}>Cancel</Button>
          <Button onClick={save}>{editing ? 'Update' : 'Log Sighting'}</Button>
        </div>
      </Modal>

      {/* Pest Database Modal */}
      <Modal open={showDb} onClose={() => setShowDb(false)} title="📚 Pest & Disease Database" width="700px">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {pestDatabase.map(pest => (
            <div key={pest.id} style={{ padding: '12px', borderRadius: '10px', border: `1px solid ${theme.borderLight}`, background: theme.bgHover }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <span style={{ fontSize: '20px' }}>{pest.icon}</span>
                <strong style={{ color: theme.text, fontSize: '14px' }}>{pest.name}</strong>
              </div>
              <div style={{ fontSize: '12px', color: theme.textSecondary, marginBottom: '4px' }}>
                <strong>Affects:</strong> {pest.affectedFamilies.join(', ')}
              </div>
              <div style={{ fontSize: '12px', color: theme.textSecondary }}>
                <strong>Organic Treatments:</strong>
                <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                  {pest.treatments.map((t, i) => <li key={i} style={{ marginBottom: '2px' }}>{t}</li>)}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}
