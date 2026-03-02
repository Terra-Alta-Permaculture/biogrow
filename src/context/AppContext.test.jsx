import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppProvider, useApp } from './AppContext';

// Test component that exposes context values
function TestConsumer({ onReady }) {
  const ctx = useApp();
  if (onReady) onReady(ctx);
  return (
    <div>
      <span data-testid="zone-count">{ctx.zones?.length ?? 0}</span>
      <span data-testid="crop-count">{ctx.crops?.length ?? 0}</span>
      <span data-testid="dark-mode">{ctx.darkMode ? 'dark' : 'light'}</span>
      <span data-testid="save-status">{ctx.saveStatus}</span>
      <button data-testid="toggle-dark" onClick={() => ctx.setDarkMode(!ctx.darkMode)}>Toggle</button>
      <button data-testid="add-zone" onClick={() => ctx.updateState(prev => ({
        ...prev,
        zones: [...prev.zones, { id: 'z-new', name: 'New Zone', beds: [] }],
      }))}>Add Zone</button>
      <button data-testid="show-toast" onClick={() => ctx.showToast('Hello!')}>Toast</button>
      <button data-testid="export" onClick={ctx.exportData}>Export</button>
    </div>
  );
}

function ToastDisplay() {
  const { toasts, dismissToast } = useApp();
  return (
    <div>
      {toasts.map(t => (
        <div key={t.id} data-testid={`toast-${t.id}`}>
          <span>{t.message}</span>
          <button onClick={() => dismissToast(t.id)}>Dismiss</button>
        </div>
      ))}
    </div>
  );
}

beforeEach(() => {
  localStorage.clear();
});

describe('AppProvider', () => {
  it('renders children', () => {
    render(<AppProvider><span>Test</span></AppProvider>);
    expect(screen.getByText('Test')).toBeInTheDocument();
  });

  it('provides default state with crops and empty zones', () => {
    render(
      <AppProvider>
        <TestConsumer />
      </AppProvider>
    );
    expect(screen.getByTestId('zone-count').textContent).toBe('0');
    // Default crops should be loaded (265+)
    expect(parseInt(screen.getByTestId('crop-count').textContent)).toBeGreaterThan(100);
  });

  it('starts in light mode', () => {
    render(
      <AppProvider>
        <TestConsumer />
      </AppProvider>
    );
    expect(screen.getByTestId('dark-mode').textContent).toBe('light');
  });

  it('toggles dark mode', async () => {
    const user = userEvent.setup();
    render(
      <AppProvider>
        <TestConsumer />
      </AppProvider>
    );
    await user.click(screen.getByTestId('toggle-dark'));
    expect(screen.getByTestId('dark-mode').textContent).toBe('dark');
  });

  it('persists dark mode preference', async () => {
    const user = userEvent.setup();
    render(
      <AppProvider>
        <TestConsumer />
      </AppProvider>
    );
    await user.click(screen.getByTestId('toggle-dark'));
    expect(localStorage.getItem('biogrow-dark')).toBe('true');
  });
});

describe('updateState', () => {
  it('adds a zone via updater function', async () => {
    const user = userEvent.setup();
    render(
      <AppProvider>
        <TestConsumer />
      </AppProvider>
    );
    expect(screen.getByTestId('zone-count').textContent).toBe('0');
    await user.click(screen.getByTestId('add-zone'));
    expect(screen.getByTestId('zone-count').textContent).toBe('1');
  });
});

describe('persistence', () => {
  it('saves state to localStorage', async () => {
    const user = userEvent.setup();
    render(
      <AppProvider>
        <TestConsumer />
      </AppProvider>
    );
    await user.click(screen.getByTestId('add-zone'));
    // Wait for debounced save
    await new Promise(r => setTimeout(r, 600));
    const saved = JSON.parse(localStorage.getItem('biogrow-data'));
    expect(saved.zones).toHaveLength(1);
    expect(saved.zones[0].name).toBe('New Zone');
  });

  it('loads state from localStorage on mount', () => {
    // Pre-seed localStorage
    localStorage.setItem('biogrow-data', JSON.stringify({
      zones: [{ id: 'z1', name: 'Saved Zone', beds: [] }],
      tasks: [],
      harvests: [],
      settings: { currentYear: 2026, lastFrostWeek: 12, firstFrostWeek: 44 },
    }));
    render(
      <AppProvider>
        <TestConsumer />
      </AppProvider>
    );
    expect(screen.getByTestId('zone-count').textContent).toBe('1');
  });
});

describe('toast system', () => {
  it('shows a toast', () => {
    let ctx;
    render(
      <AppProvider>
        <TestConsumer onReady={c => { ctx = c; }} />
        <ToastDisplay />
      </AppProvider>
    );
    act(() => { ctx.showToast('Hello!'); });
    expect(screen.getByText('Hello!')).toBeInTheDocument();
  });

  it('dismisses a toast manually', () => {
    let ctx;
    let toastId;
    render(
      <AppProvider>
        <TestConsumer onReady={c => { ctx = c; }} />
        <ToastDisplay />
      </AppProvider>
    );
    act(() => { toastId = ctx.showToast('Bye!', { duration: 60000 }); });
    expect(screen.getByText('Bye!')).toBeInTheDocument();
    act(() => { ctx.dismissToast(toastId); });
    expect(screen.queryByText('Bye!')).toBeNull();
  });
});

describe('validateImport', () => {
  it('accepts valid BioGrow data', () => {
    let ctx;
    render(
      <AppProvider>
        <TestConsumer onReady={c => { ctx = c; }} />
      </AppProvider>
    );
    const result = ctx.validateImport(JSON.stringify({
      zones: [{ id: 'z1', name: 'Zone', beds: [] }],
      crops: [],
      tasks: [],
      harvests: [],
      settings: {},
    }));
    expect(result.valid).toBe(true);
    expect(result.preview.zones).toBe(1);
  });

  it('rejects invalid JSON', () => {
    let ctx;
    render(
      <AppProvider>
        <TestConsumer onReady={c => { ctx = c; }} />
      </AppProvider>
    );
    const result = ctx.validateImport('not json');
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('Invalid JSON');
  });

  it('rejects arrays', () => {
    let ctx;
    render(
      <AppProvider>
        <TestConsumer onReady={c => { ctx = c; }} />
      </AppProvider>
    );
    const result = ctx.validateImport(JSON.stringify([1, 2, 3]));
    expect(result.valid).toBe(false);
  });

  it('rejects objects with no recognizable data', () => {
    let ctx;
    render(
      <AppProvider>
        <TestConsumer onReady={c => { ctx = c; }} />
      </AppProvider>
    );
    const result = ctx.validateImport(JSON.stringify({ foo: 'bar' }));
    expect(result.valid).toBe(false);
  });
});

describe('importData', () => {
  it('merges imported data into state', () => {
    let ctx;
    render(
      <AppProvider>
        <TestConsumer onReady={c => { ctx = c; }} />
      </AppProvider>
    );
    const result = ctx.importData({
      zones: [{ id: 'imported', name: 'Imported Zone', beds: [] }],
    });
    expect(result).toBe(true);
  });
});

describe('useApp outside provider', () => {
  it('throws error', () => {
    const Broken = () => { useApp(); return null; };
    expect(() => render(<Broken />)).toThrow('useApp must be used within AppProvider');
  });
});
