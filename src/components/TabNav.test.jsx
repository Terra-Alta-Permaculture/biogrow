import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithContext } from '../test/renderWithContext';
import TabNav, { primaryTabs, toolsTabs } from './TabNav';

describe('TabNav', () => {
  const setup = (activeTab = 'farm') => {
    const setActiveTab = vi.fn();
    renderWithContext(<TabNav activeTab={activeTab} setActiveTab={setActiveTab} />);
    return { setActiveTab };
  };

  it('renders all primary tabs', () => {
    setup();
    for (const tab of primaryTabs) {
      expect(screen.getByText(tab.label)).toBeInTheDocument();
    }
  });

  it('renders Tools dropdown button', () => {
    setup();
    expect(screen.getByText(/Tools/)).toBeInTheDocument();
  });

  it('calls setActiveTab when a primary tab is clicked', async () => {
    const { setActiveTab } = setup();
    const user = userEvent.setup();
    await user.click(screen.getByText('📋 Plan'));
    expect(setActiveTab).toHaveBeenCalledWith('plan');
  });

  it('opens dropdown and shows tool tabs when Tools is clicked', async () => {
    setup();
    const user = userEvent.setup();
    await user.click(screen.getByText(/Tools/));
    // All tool tabs should now be visible
    for (const tab of toolsTabs) {
      expect(screen.getByText(tab.label)).toBeInTheDocument();
    }
  });

  it('selects a tool tab from dropdown', async () => {
    const { setActiveTab } = setup();
    const user = userEvent.setup();
    // Open dropdown
    await user.click(screen.getByText(/Tools/));
    // Click a tool tab
    await user.click(screen.getByText('🌾 Crops'));
    expect(setActiveTab).toHaveBeenCalledWith('crops');
  });

  it('shows active tool label instead of "Tools" when a tool is active', () => {
    setup('crops');
    // Should show the active tool label
    expect(screen.getByText('🌾 Crops')).toBeInTheDocument();
  });

  it('has correct tab count', () => {
    expect(primaryTabs).toHaveLength(5);
    expect(toolsTabs).toHaveLength(10);
  });
});
