import { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';

const primaryTabs = [
  { id: 'farm', label: '🌱 Farm' },
  { id: 'demand', label: '🍽️ Demand' },
  { id: 'plan', label: '📋 Plan' },
  { id: 'nursery', label: '🪴 Nursery' },
  { id: 'harvest', label: '🧺 Harvest' },
];

const toolsTabs = [
  { id: 'tasks', label: '✅ Tasks' },
  { id: 'crops', label: '🌾 Crops' },
  { id: 'rotation', label: '🔄 Rotation' },
  { id: 'companions', label: '🤝 Companions' },
  { id: 'calculator', label: '🧮 Calculator' },
  { id: 'pests', label: '🐛 Pests' },
  { id: 'weather', label: '🌤️ Weather' },
  { id: 'irrigation', label: '💧 Irrigation' },
  { id: 'analytics', label: '📊 Analytics' },
  { id: 'profile', label: '👤 Profile' },
];

const tabs = [...primaryTabs, ...toolsTabs];

export { tabs, primaryTabs, toolsTabs };

export default function TabNav({ activeTab, setActiveTab }) {
  const { theme } = useApp();
  const [toolsOpen, setToolsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!toolsOpen) return;
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setToolsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [toolsOpen]);

  const activeTool = toolsTabs.find(t => t.id === activeTab);
  const isToolActive = !!activeTool;

  const tabStyle = (isActive) => ({
    fontFamily: "'Libre Franklin', sans-serif",
    fontSize: '13px',
    fontWeight: isActive ? '600' : '400',
    padding: '8px 14px',
    border: 'none',
    borderRadius: '8px 8px 0 0',
    cursor: 'pointer',
    background: isActive ? theme.bgTabActive : 'transparent',
    color: isActive ? theme.accent : theme.textSecondary,
    borderBottom: isActive ? `2px solid ${theme.accent}` : '2px solid transparent',
    transition: 'all 0.2s',
    whiteSpace: 'nowrap',
  });

  return (
    <nav aria-label="Main navigation" style={{
      background: theme.bgTab,
      borderBottom: `1px solid ${theme.border}`,
      padding: '0 8px',
      display: 'flex',
      alignItems: 'flex-end',
    }}>
      <div role="tablist" aria-label="Primary tabs" style={{ display: 'flex', gap: '2px', padding: '8px 0 0', flex: 1 }}>
        {primaryTabs.map(tab => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => { setActiveTab(tab.id); setToolsOpen(false); }}
            style={tabStyle(activeTab === tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tools dropdown */}
      <div ref={dropdownRef} style={{ position: 'relative', padding: '8px 0 0' }}>
        <button
          onClick={() => setToolsOpen(!toolsOpen)}
          aria-haspopup="true"
          aria-expanded={toolsOpen}
          style={{
            ...tabStyle(isToolActive),
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          {isToolActive ? activeTool.label : '⚙️ Tools'}
          <span style={{ fontSize: '10px', marginLeft: '2px', opacity: 0.6 }} aria-hidden="true">{toolsOpen ? '▲' : '▼'}</span>
        </button>

        {toolsOpen && (
          <div role="menu" style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            zIndex: 1000,
            minWidth: '200px',
            background: theme.bgCard || theme.bg,
            border: `1px solid ${theme.border}`,
            borderRadius: '8px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            padding: '4px 0',
            marginTop: '2px',
          }}>
            {toolsTabs.map(tab => (
              <button
                key={tab.id}
                role="menuitem"
                onClick={() => { setActiveTab(tab.id); setToolsOpen(false); }}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '10px 16px',
                  border: 'none',
                  background: activeTab === tab.id ? (theme.accentLight || '#e8f5e9') : 'transparent',
                  color: activeTab === tab.id ? theme.accent : theme.text,
                  fontWeight: activeTab === tab.id ? '600' : '400',
                  fontSize: '13px',
                  fontFamily: "'Libre Franklin', sans-serif",
                  cursor: 'pointer',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => { if (activeTab !== tab.id) e.target.style.background = theme.bgHover || '#f5f5f5'; }}
                onMouseLeave={(e) => { if (activeTab !== tab.id) e.target.style.background = 'transparent'; }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </nav>
  );
}
