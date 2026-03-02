import { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Card, SummaryCard, Button, Modal, FormField, Input, Select, Badge } from '../components/shared';
import { generateId, formatDate } from '../utils/helpers';

const CATEGORIES = [
  { value: 'watering', label: 'Watering', icon: '\u{1F4A7}' },
  { value: 'feeding', label: 'Feeding', icon: '\u{1F9EA}' },
  { value: 'weeding', label: 'Weeding', icon: '\u{1F33E}' },
  { value: 'planting', label: 'Planting', icon: '\u{1F331}' },
  { value: 'harvesting', label: 'Harvesting', icon: '\u{1F9FA}' },
  { value: 'pruning', label: 'Pruning', icon: '\u2702\uFE0F' },
  { value: 'pest-check', label: 'Pest Check', icon: '\u{1F41B}' },
  { value: 'soil-work', label: 'Soil Work', icon: '\u{1FAB1}' },
  { value: 'infrastructure', label: 'Infrastructure', icon: '\u{1F527}' },
  { value: 'other', label: 'Other', icon: '\u{1F4CB}' },
];

const PRIORITIES = [
  { value: 'high', label: 'High', icon: '\u{1F534}', color: '#d32f2f' },
  { value: 'medium', label: 'Medium', icon: '\u{1F7E1}', color: '#f57c00' },
  { value: 'low', label: 'Low', icon: '\u{1F7E2}', color: '#388e3c' },
];

const RECURRENCES = [
  { value: 'one-time', label: 'One-time' },
  { value: 'daily', label: 'Daily' },
  { value: 'every-3-days', label: 'Every 3 days' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Biweekly' },
  { value: 'monthly', label: 'Monthly' },
];

const QUICK_TEMPLATES = [
  { title: 'Water beds', category: 'watering', priority: 'high', icon: '\u{1F4A7}' },
  { title: 'Check for pests', category: 'pest-check', priority: 'medium', icon: '\u{1F41B}' },
  { title: 'Weed beds', category: 'weeding', priority: 'medium', icon: '\u{1F33E}' },
  { title: 'Harvest greens', category: 'harvesting', priority: 'high', icon: '\u{1F9FA}' },
  { title: 'Feed crops', category: 'feeding', priority: 'medium', icon: '\u{1F9EA}' },
  { title: 'Prune plants', category: 'pruning', priority: 'low', icon: '\u2702\uFE0F' },
];

function getCategoryInfo(value) {
  return CATEGORIES.find(c => c.value === value) || CATEGORIES[CATEGORIES.length - 1];
}

function getPriorityInfo(value) {
  return PRIORITIES.find(p => p.value === value) || PRIORITIES[1];
}

function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getSunday(monday) {
  const d = new Date(monday);
  d.setDate(d.getDate() + 6);
  d.setHours(23, 59, 59, 999);
  return d;
}

function toDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatWeekRange(monday) {
  const sunday = getSunday(monday);
  const opts = { day: 'numeric', month: 'short' };
  const monStr = monday.toLocaleDateString('en-GB', opts);
  const sunStr = sunday.toLocaleDateString('en-GB', { ...opts, year: 'numeric' });
  return `${monStr} \u2013 ${sunStr}`;
}

const emptyForm = {
  title: '',
  category: 'other',
  priority: 'medium',
  status: 'pending',
  dueDate: toDateStr(new Date()),
  recurrence: 'one-time',
  bedId: '',
  zoneId: '',
  notes: '',
};

export default function TasksTab() {
  const { tasks, zones, updateState, theme, showToast } = useApp();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [weekOffset, setWeekOffset] = useState(0);
  const [viewMode, setViewMode] = useState('grouped');

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const currentMonday = useMemo(() => {
    const m = getMonday(today);
    m.setDate(m.getDate() + weekOffset * 7);
    return m;
  }, [today, weekOffset]);

  const currentSunday = useMemo(() => getSunday(currentMonday), [currentMonday]);

  // --- Computed stats ---
  const stats = useMemo(() => {
    const todayStr = toDateStr(today);
    const mondayStr = toDateStr(getMonday(today));
    const sundayStr = toDateStr(getSunday(getMonday(today)));

    const pending = tasks.filter(t => t.status === 'pending');
    const overdue = pending.filter(t => t.dueDate && t.dueDate < todayStr);
    const dueThisWeek = pending.filter(t => t.dueDate && t.dueDate >= mondayStr && t.dueDate <= sundayStr);
    const completedThisWeek = tasks.filter(t =>
      t.status === 'completed' && t.completedDate && t.completedDate >= mondayStr && t.completedDate <= sundayStr
    );

    return {
      total: tasks.length,
      pending: pending.length,
      overdue: overdue.length,
      dueThisWeek: dueThisWeek.length,
      completedThisWeek: completedThisWeek.length,
    };
  }, [tasks, today]);

  // --- Filtered tasks ---
  const filteredTasks = useMemo(() => {
    const todayStr = toDateStr(today);
    const mondayStr = toDateStr(currentMonday);
    const sundayStr = toDateStr(currentSunday);

    let list = [...tasks];

    if (filterStatus === 'pending') {
      list = list.filter(t => t.status === 'pending');
    } else if (filterStatus === 'completed') {
      list = list.filter(t => t.status === 'completed');
    } else if (filterStatus === 'overdue') {
      list = list.filter(t => t.status === 'pending' && t.dueDate && t.dueDate < todayStr);
    } else if (filterStatus === 'this-week') {
      list = list.filter(t => t.dueDate && t.dueDate >= mondayStr && t.dueDate <= sundayStr);
    }

    if (filterCategory !== 'all') {
      list = list.filter(t => t.category === filterCategory);
    }

    list.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      if (a.status !== b.status) return a.status === 'pending' ? -1 : 1;
      if (a.status === 'pending') {
        if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        }
      }
      if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      return 0;
    });

    return list;
  }, [tasks, filterStatus, filterCategory, today, currentMonday, currentSunday]);

  // --- Grouped tasks (deadline grouping) ---
  const groupedTasks = useMemo(() => {
    if (viewMode !== 'grouped') return null;
    const todayStr = toDateStr(today);
    const mondayStr = toDateStr(getMonday(today));
    const sundayStr = toDateStr(getSunday(getMonday(today)));
    const nextMonday = new Date(getMonday(today));
    nextMonday.setDate(nextMonday.getDate() + 7);
    const nextSunday = getSunday(nextMonday);
    const nextMondayStr = toDateStr(nextMonday);
    const nextSundayStr = toDateStr(nextSunday);

    let list = [...tasks];
    if (filterCategory !== 'all') list = list.filter(t => t.category === filterCategory);

    const pending = list.filter(t => t.status === 'pending');
    const completed = list.filter(t => t.status === 'completed');

    const overdue = pending.filter(t => t.dueDate && t.dueDate < todayStr);
    const thisWeek = pending.filter(t => t.dueDate && t.dueDate >= todayStr && t.dueDate <= sundayStr);
    const nextWeek = pending.filter(t => t.dueDate && t.dueDate >= nextMondayStr && t.dueDate <= nextSundayStr);
    const later = pending.filter(t => t.dueDate && t.dueDate > nextSundayStr);
    const noDue = pending.filter(t => !t.dueDate);

    const sortByPriority = (a, b) => {
      const order = { high: 0, medium: 1, low: 2 };
      return (order[a.priority] || 1) - (order[b.priority] || 1);
    };

    return [
      { id: 'overdue', label: 'Overdue', color: '#dc2626', icon: '\u{1F6A8}', tasks: overdue.sort(sortByPriority) },
      { id: 'this-week', label: 'Due This Week', color: '#d97706', icon: '\u{1F4C5}', tasks: thisWeek.sort(sortByPriority) },
      { id: 'next-week', label: 'Due Next Week', color: '#2563eb', icon: '\u{1F4C6}', tasks: nextWeek.sort(sortByPriority) },
      { id: 'later', label: 'Later', color: '#6b7280', icon: '\u23F3', tasks: later.sort(sortByPriority) },
      { id: 'no-due', label: 'No Due Date', color: '#9ca3af', icon: '\u{1F4CB}', tasks: noDue.sort(sortByPriority) },
      { id: 'completed', label: 'Completed', color: '#16a34a', icon: '\u2705', tasks: completed.sort((a, b) => (b.completedDate || '').localeCompare(a.completedDate || '')) },
    ].filter(g => g.tasks.length > 0);
  }, [tasks, filterCategory, viewMode, today]);

  // --- Zone/bed helpers ---
  const allBeds = useMemo(() => {
    const beds = [];
    (zones || []).forEach(z => {
      (z.beds || []).forEach(b => {
        beds.push({ ...b, zoneName: z.name, zoneId: z.id });
      });
    });
    return beds;
  }, [zones]);

  const filteredBeds = useMemo(() => {
    if (!form.zoneId) return allBeds;
    return allBeds.filter(b => b.zoneId === form.zoneId);
  }, [allBeds, form.zoneId]);

  // --- Handlers ---
  function openAdd() {
    setEditingId(null);
    setForm({ ...emptyForm, dueDate: toDateStr(new Date()) });
    setModalOpen(true);
  }

  function openEdit(task) {
    setEditingId(task.id);
    setForm({
      title: task.title || '',
      category: task.category || 'other',
      priority: task.priority || 'medium',
      status: task.status || 'pending',
      dueDate: task.dueDate || '',
      recurrence: task.recurrence || 'one-time',
      bedId: task.bedId || '',
      zoneId: task.zoneId || '',
      notes: task.notes || '',
    });
    setModalOpen(true);
  }

  function handleSave() {
    if (!form.title.trim()) return;

    if (editingId) {
      updateState(prev => ({
        ...prev,
        tasks: prev.tasks.map(t =>
          t.id === editingId ? { ...t, ...form, title: form.title.trim() } : t
        ),
      }));
    } else {
      const newTask = {
        id: generateId(),
        ...form,
        title: form.title.trim(),
        status: 'pending',
        completedDate: null,
      };
      updateState(prev => ({ ...prev, tasks: [...prev.tasks, newTask] }));
    }

    setModalOpen(false);
    setForm({ ...emptyForm });
    setEditingId(null);
  }

  const [deleteConfirm, setDeleteConfirm] = useState(null);

  function handleDelete(id) {
    const item = tasks.find(t => t.id === id);
    updateState(prev => ({ ...prev, tasks: prev.tasks.filter(t => t.id !== id) }));
    setDeleteConfirm(null);
    if (item) {
      showToast(`Task "${item.title}" deleted`, {
        type: 'warning',
        undo: () => updateState(prev => ({ ...prev, tasks: [...prev.tasks, item] })),
      });
    }
  }

  function toggleComplete(id) {
    updateState(prev => ({
      ...prev,
      tasks: prev.tasks.map(t => {
        if (t.id !== id) return t;
        const nowComplete = t.status !== 'completed';
        return {
          ...t,
          status: nowComplete ? 'completed' : 'pending',
          completedDate: nowComplete ? toDateStr(new Date()) : null,
        };
      }),
    }));
  }

  function handleQuickAdd(template) {
    const newTask = {
      id: generateId(),
      title: template.title,
      category: template.category,
      priority: template.priority,
      status: 'pending',
      dueDate: toDateStr(new Date()),
      recurrence: 'one-time',
      bedId: '',
      zoneId: '',
      notes: '',
      completedDate: null,
    };
    updateState(prev => ({ ...prev, tasks: [...prev.tasks, newTask] }));
  }

  function updateForm(key, value) {
    setForm(prev => {
      const next = { ...prev, [key]: value };
      if (key === 'zoneId') next.bedId = '';
      return next;
    });
  }

  function isOverdue(task) {
    return task.status === 'pending' && task.dueDate && task.dueDate < toDateStr(today);
  }

  function isDueToday(task) {
    return task.status === 'pending' && task.dueDate === toDateStr(today);
  }

  // --- Styles ---
  const headingFont = "'DM Serif Display', serif";
  const bodyFont = "'Libre Franklin', sans-serif";

  const sectionTitle = {
    fontFamily: headingFont,
    fontSize: '15px',
    fontWeight: '600',
    color: theme.text,
    margin: '0 0 10px 0',
  };

  return (
    <div style={{ padding: '20px', maxWidth: '960px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontFamily: headingFont, fontSize: '24px', color: theme.text, margin: 0 }}>
            Task Manager
          </h2>
          <p style={{ fontFamily: bodyFont, fontSize: '13px', color: theme.textMuted, margin: '4px 0 0 0' }}>
            Plan, track, and complete your garden tasks
          </p>
        </div>
        <Button onClick={openAdd} style={{ fontSize: '14px', padding: '10px 20px' }}>
          + New Task
        </Button>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '20px' }}>
        <SummaryCard icon={'\u{1F4CB}'} label="Total Tasks" value={stats.total} color={theme.text} />
        <SummaryCard icon={'\u23F3'} label="Pending" value={stats.pending} color={theme.warning} />
        <SummaryCard icon={'\u{1F6A8}'} label="Overdue" value={stats.overdue} color={theme.error} />
        <SummaryCard icon={'\u{1F4C5}'} label="Due This Week" value={stats.dueThisWeek} color={theme.accent} />
        <SummaryCard icon={'\u2705'} label="Done This Week" value={stats.completedThisWeek} color={theme.success} />
      </div>

      {/* Week Navigator */}
      <Card style={{ marginBottom: '16px', padding: '12px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
          <button
            onClick={() => setWeekOffset(prev => prev - 1)}
            style={{
              background: 'none',
              border: `1px solid ${theme.border}`,
              borderRadius: '6px',
              padding: '6px 12px',
              cursor: 'pointer',
              color: theme.textSecondary,
              fontFamily: bodyFont,
              fontSize: '14px',
            }}
          >
            ◀ Prev
          </button>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: headingFont, fontSize: '15px', color: theme.text }}>
              {formatWeekRange(currentMonday)}
            </div>
            {weekOffset !== 0 && (
              <button
                onClick={() => setWeekOffset(0)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: theme.accent,
                  fontSize: '11px',
                  fontFamily: bodyFont,
                  cursor: 'pointer',
                  padding: '2px 0 0 0',
                  textDecoration: 'underline',
                }}
              >
                Back to this week
              </button>
            )}
          </div>
          <button
            onClick={() => setWeekOffset(prev => prev + 1)}
            style={{
              background: 'none',
              border: `1px solid ${theme.border}`,
              borderRadius: '6px',
              padding: '6px 12px',
              cursor: 'pointer',
              color: theme.textSecondary,
              fontFamily: bodyFont,
              fontSize: '14px',
            }}
          >
            Next ▶
          </button>
        </div>
      </Card>

      {/* Filters */}
      <Card style={{ marginBottom: '16px', padding: '12px 16px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', fontFamily: bodyFont, color: theme.textSecondary, fontWeight: '600' }}>Status:</span>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              style={{
                padding: '6px 10px',
                borderRadius: '6px',
                border: `1px solid ${theme.border}`,
                background: theme.bgInput,
                color: theme.text,
                fontSize: '13px',
                fontFamily: bodyFont,
                outline: 'none',
              }}
            >
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
              <option value="overdue">Overdue</option>
              <option value="this-week">This Week</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', fontFamily: bodyFont, color: theme.textSecondary, fontWeight: '600' }}>Category:</span>
            <select
              value={filterCategory}
              onChange={e => setFilterCategory(e.target.value)}
              style={{
                padding: '6px 10px',
                borderRadius: '6px',
                border: `1px solid ${theme.border}`,
                background: theme.bgInput,
                color: theme.text,
                fontSize: '13px',
                fontFamily: bodyFont,
                outline: 'none',
              }}
            >
              <option value="all">All Categories</option>
              {CATEGORIES.map(c => (
                <option key={c.value} value={c.value}>{c.icon} {c.label}</option>
              ))}
            </select>
          </div>

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ display: 'flex', borderRadius: '6px', overflow: 'hidden', border: `1px solid ${theme.border}` }}>
              {[{ id: 'grouped', label: 'Grouped' }, { id: 'list', label: 'List' }].map(v => (
                <button
                  key={v.id}
                  onClick={() => setViewMode(v.id)}
                  style={{
                    padding: '4px 10px',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '11px',
                    fontFamily: bodyFont,
                    fontWeight: viewMode === v.id ? '600' : '400',
                    background: viewMode === v.id ? theme.accent : theme.bgInput,
                    color: viewMode === v.id ? '#fff' : theme.textSecondary,
                    transition: 'all 0.15s',
                  }}
                >
                  {v.label}
                </button>
              ))}
            </div>
            <span style={{ fontSize: '12px', color: theme.textMuted, fontFamily: bodyFont }}>
              {filteredTasks.length} task{filteredTasks.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </Card>

      {/* Quick-add Templates */}
      <Card style={{ marginBottom: '16px', padding: '12px 16px' }}>
        <h4 style={sectionTitle}>Quick Add</h4>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {QUICK_TEMPLATES.map(tpl => (
            <button
              key={tpl.title}
              onClick={() => handleQuickAdd(tpl)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '6px 12px',
                borderRadius: '20px',
                border: `1px solid ${theme.borderLight}`,
                background: theme.bgHover,
                color: theme.textSecondary,
                fontSize: '12px',
                fontFamily: bodyFont,
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = theme.accentLight;
                e.currentTarget.style.borderColor = theme.accent;
                e.currentTarget.style.color = theme.accent;
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = theme.bgHover;
                e.currentTarget.style.borderColor = theme.borderLight;
                e.currentTarget.style.color = theme.textSecondary;
              }}
            >
              <span>{tpl.icon}</span>
              {tpl.title}
            </button>
          ))}
        </div>
      </Card>

      {/* Task List */}
      <div>
        {viewMode === 'grouped' && groupedTasks ? (
          groupedTasks.length === 0 ? (
            <Card style={{ textAlign: 'center', padding: '40px 20px' }}>
              <div style={{ fontSize: '40px', marginBottom: '10px' }}>{'\u{1F331}'}</div>
              <p style={{ fontFamily: bodyFont, fontSize: '14px', color: theme.textMuted, margin: 0 }}>
                No tasks found. Add a task to get started!
              </p>
            </Card>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {groupedTasks.map(group => (
                <div key={group.id}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px',
                    paddingLeft: '4px', borderLeft: `3px solid ${group.color}`, paddingBottom: '2px',
                  }}>
                    <span style={{ fontSize: '14px' }}>{group.icon}</span>
                    <span style={{ fontFamily: headingFont, fontSize: '14px', color: theme.text, fontWeight: '600' }}>{group.label}</span>
                    <Badge bg={group.color + '20'} color={group.color}>{group.tasks.length}</Badge>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {group.tasks.map(task => {
                      const catInfo = getCategoryInfo(task.category);
                      const priInfo = getPriorityInfo(task.priority);
                      const overdue = isOverdue(task);
                      const dueToday = isDueToday(task);
                      const isCompleted = task.status === 'completed';
                      const zone = zones?.find(z => z.id === task.zoneId);
                      const bed = zone?.beds?.find(b => b.id === task.bedId);
                      return (
                        <Card key={task.id} style={{
                          padding: '12px 16px', opacity: isCompleted ? 0.7 : 1,
                          borderLeft: `4px solid ${overdue ? theme.error : dueToday ? theme.warning : priInfo.color}`,
                          background: overdue ? theme.errorLight : isCompleted ? theme.bgHover : theme.bgCard,
                        }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                            <button onClick={() => toggleComplete(task.id)} style={{
                              width: '22px', height: '22px', minWidth: '22px', borderRadius: '6px',
                              border: `2px solid ${isCompleted ? theme.success : theme.border}`,
                              background: isCompleted ? theme.success : 'transparent',
                              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '2px', padding: 0,
                            }} title={isCompleted ? 'Mark as pending' : 'Mark as complete'}>
                              {isCompleted && <span style={{ color: '#fff', fontSize: '13px', lineHeight: 1 }}>{'\u2713'}</span>}
                            </button>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                                <span style={{ fontSize: '15px' }}>{catInfo.icon}</span>
                                <span style={{
                                  fontFamily: bodyFont, fontSize: '14px', fontWeight: '600',
                                  color: isCompleted ? theme.textMuted : theme.text,
                                  textDecoration: isCompleted ? 'line-through' : 'none',
                                }}>{task.title}</span>
                                <Badge bg={priInfo.color + '20'} color={priInfo.color} style={{ fontSize: '10px' }}>{priInfo.icon} {priInfo.label}</Badge>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                                {task.dueDate && <span style={{ fontSize: '11px', color: overdue ? theme.error : theme.textMuted, fontFamily: bodyFont }}>{'\u{1F4C5}'} {formatDate(task.dueDate)}</span>}
                                {zone && <span style={{ fontSize: '11px', color: theme.textMuted, fontFamily: bodyFont }}>{'\u{1F4CD}'} {zone.name}{bed ? ` / ${bed.name}` : ''}</span>}
                                {isCompleted && task.completedDate && <span style={{ fontSize: '11px', color: theme.success, fontFamily: bodyFont }}>{'\u2705'} {formatDate(task.completedDate)}</span>}
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                              <button onClick={() => openEdit(task)} style={{ background: 'none', border: `1px solid ${theme.borderLight}`, borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', color: theme.textMuted, fontSize: '13px' }} title="Edit">{'\u270F\uFE0F'}</button>
                              <button onClick={() => setDeleteConfirm(task)} style={{ background: 'none', border: `1px solid ${theme.borderLight}`, borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', color: theme.textMuted, fontSize: '13px' }} title="Delete">{'\u{1F5D1}\uFE0F'}</button>
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )
        ) : filteredTasks.length === 0 ? (
          <Card style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div style={{ fontSize: '40px', marginBottom: '10px' }}>{'\u{1F331}'}</div>
            <p style={{ fontFamily: bodyFont, fontSize: '14px', color: theme.textMuted, margin: 0 }}>
              No tasks found. Add a task to get started!
            </p>
          </Card>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {filteredTasks.map(task => {
              const catInfo = getCategoryInfo(task.category);
              const priInfo = getPriorityInfo(task.priority);
              const overdue = isOverdue(task);
              const dueToday = isDueToday(task);
              const isCompleted = task.status === 'completed';

              const zone = zones?.find(z => z.id === task.zoneId);
              const bed = zone?.beds?.find(b => b.id === task.bedId);

              return (
                <Card
                  key={task.id}
                  style={{
                    padding: '12px 16px',
                    opacity: isCompleted ? 0.7 : 1,
                    borderLeft: `4px solid ${overdue ? theme.error : dueToday ? theme.warning : priInfo.color}`,
                    background: overdue ? theme.errorLight : isCompleted ? theme.bgHover : theme.bgCard,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                    {/* Checkbox */}
                    <button
                      onClick={() => toggleComplete(task.id)}
                      style={{
                        width: '22px',
                        height: '22px',
                        minWidth: '22px',
                        borderRadius: '6px',
                        border: `2px solid ${isCompleted ? theme.success : theme.border}`,
                        background: isCompleted ? theme.success : 'transparent',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginTop: '2px',
                        transition: 'all 0.15s',
                        padding: 0,
                      }}
                      title={isCompleted ? 'Mark as pending' : 'Mark as complete'}
                    >
                      {isCompleted && (
                        <span style={{ color: '#fff', fontSize: '13px', lineHeight: 1 }}>{'\u2713'}</span>
                      )}
                    </button>

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                        <span style={{ fontSize: '15px' }}>{catInfo.icon}</span>
                        <span style={{
                          fontFamily: bodyFont,
                          fontSize: '14px',
                          fontWeight: '600',
                          color: isCompleted ? theme.textMuted : theme.text,
                          textDecoration: isCompleted ? 'line-through' : 'none',
                        }}>
                          {task.title}
                        </span>

                        <Badge
                          bg={priInfo.color + '20'}
                          color={priInfo.color}
                          style={{ fontSize: '10px' }}
                        >
                          {priInfo.icon} {priInfo.label}
                        </Badge>

                        {overdue && (
                          <Badge bg={theme.error} color="#fff" style={{ fontSize: '10px' }}>
                            Overdue
                          </Badge>
                        )}
                        {dueToday && !overdue && (
                          <Badge bg={theme.warning} color="#fff" style={{ fontSize: '10px' }}>
                            Due Today
                          </Badge>
                        )}
                        {task.recurrence && task.recurrence !== 'one-time' && (
                          <Badge bg={theme.accentLight} color={theme.accent} style={{ fontSize: '10px' }}>
                            {'\u{1F501}'} {RECURRENCES.find(r => r.value === task.recurrence)?.label || task.recurrence}
                          </Badge>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                        {task.dueDate && (
                          <span style={{ fontSize: '11px', color: overdue ? theme.error : theme.textMuted, fontFamily: bodyFont }}>
                            {'\u{1F4C5}'} {formatDate(task.dueDate)}
                          </span>
                        )}
                        {zone && (
                          <span style={{ fontSize: '11px', color: theme.textMuted, fontFamily: bodyFont }}>
                            {'\u{1F4CD}'} {zone.name}{bed ? ` / ${bed.name}` : ''}
                          </span>
                        )}
                        {task.notes && (
                          <span style={{ fontSize: '11px', color: theme.textMuted, fontFamily: bodyFont, fontStyle: 'italic' }}>
                            {'\u{1F4DD}'} {task.notes.length > 40 ? task.notes.slice(0, 40) + '...' : task.notes}
                          </span>
                        )}
                        {isCompleted && task.completedDate && (
                          <span style={{ fontSize: '11px', color: theme.success, fontFamily: bodyFont }}>
                            {'\u2705'} Completed {formatDate(task.completedDate)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                      <button
                        onClick={() => openEdit(task)}
                        style={{
                          background: 'none',
                          border: `1px solid ${theme.borderLight}`,
                          borderRadius: '6px',
                          padding: '4px 8px',
                          cursor: 'pointer',
                          color: theme.textMuted,
                          fontSize: '13px',
                          transition: 'all 0.15s',
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.borderColor = theme.accent;
                          e.currentTarget.style.color = theme.accent;
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.borderColor = theme.borderLight;
                          e.currentTarget.style.color = theme.textMuted;
                        }}
                        title="Edit task"
                      >
                        {'\u270F\uFE0F'}
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(task)}
                        style={{
                          background: 'none',
                          border: `1px solid ${theme.borderLight}`,
                          borderRadius: '6px',
                          padding: '4px 8px',
                          cursor: 'pointer',
                          color: theme.textMuted,
                          fontSize: '13px',
                          transition: 'all 0.15s',
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.borderColor = theme.error;
                          e.currentTarget.style.color = theme.error;
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.borderColor = theme.borderLight;
                          e.currentTarget.style.color = theme.textMuted;
                        }}
                        title="Delete task"
                      >
                        {'\u{1F5D1}\uFE0F'}
                      </button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditingId(null); }}
        title={editingId ? 'Edit Task' : 'New Task'}
        width="540px"
      >
        <FormField label="Task Title">
          <Input
            value={form.title}
            onChange={e => updateForm('title', e.target.value)}
            placeholder="e.g. Water the tomato beds"
            autoFocus
          />
        </FormField>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <FormField label="Category">
            <Select value={form.category} onChange={e => updateForm('category', e.target.value)}>
              {CATEGORIES.map(c => (
                <option key={c.value} value={c.value}>{c.icon} {c.label}</option>
              ))}
            </Select>
          </FormField>

          <FormField label="Priority">
            <Select value={form.priority} onChange={e => updateForm('priority', e.target.value)}>
              {PRIORITIES.map(p => (
                <option key={p.value} value={p.value}>{p.icon} {p.label}</option>
              ))}
            </Select>
          </FormField>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <FormField label="Due Date">
            <Input
              type="date"
              value={form.dueDate}
              onChange={e => updateForm('dueDate', e.target.value)}
            />
          </FormField>

          <FormField label="Recurrence">
            <Select value={form.recurrence} onChange={e => updateForm('recurrence', e.target.value)}>
              {RECURRENCES.map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </Select>
          </FormField>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <FormField label="Zone (optional)">
            <Select value={form.zoneId} onChange={e => updateForm('zoneId', e.target.value)}>
              <option value="">-- No zone --</option>
              {(zones || []).map(z => (
                <option key={z.id} value={z.id}>{z.name}</option>
              ))}
            </Select>
          </FormField>

          <FormField label="Bed (optional)">
            <Select value={form.bedId} onChange={e => updateForm('bedId', e.target.value)}>
              <option value="">-- No bed --</option>
              {filteredBeds.map(b => (
                <option key={b.id} value={b.id}>{b.name} ({b.zoneName})</option>
              ))}
            </Select>
          </FormField>
        </div>

        {editingId && (
          <FormField label="Status">
            <Select value={form.status} onChange={e => updateForm('status', e.target.value)}>
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
            </Select>
          </FormField>
        )}

        <FormField label="Notes (optional)">
          <textarea
            value={form.notes}
            onChange={e => updateForm('notes', e.target.value)}
            placeholder="Additional details..."
            rows={3}
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: '8px',
              border: `1px solid ${theme.border}`,
              background: theme.bgInput,
              color: theme.text,
              fontSize: '14px',
              fontFamily: bodyFont,
              outline: 'none',
              boxSizing: 'border-box',
              resize: 'vertical',
            }}
          />
        </FormField>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
          <Button
            variant="ghost"
            onClick={() => { setModalOpen(false); setEditingId(null); }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            style={{ opacity: form.title.trim() ? 1 : 0.5 }}
          >
            {editingId ? 'Save Changes' : 'Add Task'}
          </Button>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Delete Task?" width="400px">
        {deleteConfirm && (
          <div>
            <p style={{ margin: '0 0 16px', color: theme.textSecondary, fontSize: '14px' }}>
              Are you sure you want to delete <strong>"{deleteConfirm.title}"</strong>?
            </p>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <Button variant="ghost" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
              <button onClick={() => handleDelete(deleteConfirm.id)} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#e53935', color: '#fff', fontWeight: '600', cursor: 'pointer', fontSize: '13px' }}>Delete</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
