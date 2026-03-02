import { describe, it, expect, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CropsTab from './CropsTab';
import { renderWithContext, makeUser } from '../test/renderWithContext';

// AppContext always loads 265 default crops, so we test with those
const initialState = {
  zones: [{ id: 'z1', name: 'Zone 1', beds: [{ id: 'b1', name: 'Bed 1', width: 0.75, length: 10, plantings: [] }] }],
  tasks: [],
  harvests: [],
  pestLogs: [],
  rotationHistory: [],
  selectedCropIds: ['lettuce', 'tomato'],
  settings: { currentYear: 2026, lastFrostWeek: 12, firstFrostWeek: 44 },
};

beforeEach(() => {
  localStorage.clear();
  globalThis.IntersectionObserver = class {
    constructor(cb) { this._cb = cb; }
    observe() { this._cb([{ isIntersecting: true }]); }
    disconnect() {}
  };
});

describe('CropsTab', () => {
  it('renders heading', () => {
    renderWithContext(<CropsTab />, { initialState, initialUser: makeUser() });
    expect(screen.getByText(/Crop Database/)).toBeInTheDocument();
  });

  it('shows crop count', () => {
    renderWithContext(<CropsTab />, { initialState, initialUser: makeUser() });
    expect(screen.getByText(/crops$/)).toBeInTheDocument();
  });

  it('renders type filter buttons', () => {
    renderWithContext(<CropsTab />, { initialState, initialUser: makeUser() });
    // Use getAllBy since "All" appears in "Select All Visible" too
    expect(screen.getAllByText(/Vegetables/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Herbs/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Flowers/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Cover Crops/).length).toBeGreaterThan(0);
  });

  it('filters by type', async () => {
    const user = userEvent.setup();
    renderWithContext(<CropsTab />, { initialState, initialUser: makeUser() });
    // Click Herbs filter
    const herbsBtns = screen.getAllByText(/🌿 Herbs/);
    await user.click(herbsBtns[0]); // first one is the filter button
    // Basil is an herb and should be near the top alphabetically
    expect(screen.getAllByText(/Basil/).length).toBeGreaterThan(0);
    // Broccoli is a vegetable — should be hidden
    expect(screen.queryByText(/Broccoli/)).toBeNull();
  });

  it('filters by search', async () => {
    const user = userEvent.setup();
    renderWithContext(<CropsTab />, { initialState, initialUser: makeUser() });
    const searchInput = screen.getByPlaceholderText(/search/i);
    await user.type(searchInput, 'Broccoli');
    expect(screen.getAllByText(/Broccoli/).length).toBeGreaterThan(0);
    // Other crops should not appear
    expect(screen.queryByText(/Zinnia/)).toBeNull();
  });

  it('searches by family name', async () => {
    const user = userEvent.setup();
    renderWithContext(<CropsTab />, { initialState, initialUser: makeUser() });
    const searchInput = screen.getByPlaceholderText(/search/i);
    await user.type(searchInput, 'Solanaceae');
    // Should show solanaceae crops (tomato, pepper, eggplant, etc.)
    expect(screen.getAllByText(/Solanaceae/).length).toBeGreaterThan(0);
    // Non-solanaceae crops hidden
    expect(screen.queryByText(/Broccoli/)).toBeNull();
  });

  it('shows checkboxes for crop selection', () => {
    renderWithContext(<CropsTab />, { initialState, initialUser: makeUser() });
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBeGreaterThan(0);
    // At least some should be checked (lettuce/tomato from selectedCropIds)
    const checked = checkboxes.filter(cb => cb.checked);
    expect(checked.length).toBeGreaterThanOrEqual(1);
  });

  it('toggles crop selection', async () => {
    const user = userEvent.setup();
    renderWithContext(<CropsTab />, { initialState, initialUser: makeUser() });
    const checkboxes = screen.getAllByRole('checkbox');
    const unchecked = checkboxes.find(cb => !cb.checked);
    await user.click(unchecked);
    expect(unchecked.checked).toBe(true);
  });

  it('shows Add Crop button', () => {
    renderWithContext(<CropsTab />, { initialState, initialUser: makeUser() });
    expect(screen.getByText(/Add Crop/i)).toBeInTheDocument();
  });

  it('opens add crop modal', async () => {
    const user = userEvent.setup();
    renderWithContext(<CropsTab />, { initialState, initialUser: makeUser() });
    await user.click(screen.getByText(/Add Crop/i));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('displays season info', () => {
    renderWithContext(<CropsTab />, { initialState, initialUser: makeUser() });
    expect(screen.getAllByText(/Cool/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Warm/).length).toBeGreaterThan(0);
  });
});
