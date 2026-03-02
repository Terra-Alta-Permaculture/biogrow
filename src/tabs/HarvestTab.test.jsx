import { describe, it, expect, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HarvestTab from './HarvestTab';
import { renderWithContext, makeUser } from '../test/renderWithContext';

const makeState = (harvests = []) => ({
  zones: [{ id: 'z1', name: 'Zone 1', beds: [{ id: 'b1', name: 'Bed 1', width: 0.75, length: 10, plantings: [] }] }],
  tasks: [],
  harvests,
  settings: { currentYear: 2026, lastFrostWeek: 12, firstFrostWeek: 44 },
  selectedCropIds: ['lettuce', 'tomato'],
});

beforeEach(() => {
  localStorage.clear();
});

describe('HarvestTab', () => {
  it('renders empty state message when no harvests', () => {
    renderWithContext(<HarvestTab />, { initialState: makeState(), initialUser: makeUser() });
    expect(screen.getByText(/no harvest/i)).toBeInTheDocument();
  });

  it('renders heading', () => {
    renderWithContext(<HarvestTab />, { initialState: makeState(), initialUser: makeUser() });
    // Heading contains emoji + text
    expect(screen.getAllByText(/Harvest Log/i).length).toBeGreaterThan(0);
  });

  it('shows summary cards', () => {
    renderWithContext(<HarvestTab />, { initialState: makeState(), initialUser: makeUser() });
    expect(screen.getByText('Total Harvests')).toBeInTheDocument();
    expect(screen.getByText('Total Yield')).toBeInTheDocument();
    expect(screen.getByText('Revenue')).toBeInTheDocument();
  });

  it('renders Log Harvest button', () => {
    renderWithContext(<HarvestTab />, { initialState: makeState(), initialUser: makeUser() });
    expect(screen.getByText('+ Log Harvest')).toBeInTheDocument();
  });

  it('opens add harvest modal', async () => {
    const user = userEvent.setup();
    renderWithContext(<HarvestTab />, { initialState: makeState(), initialUser: makeUser() });
    await user.click(screen.getByText('+ Log Harvest'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('renders harvest entries when provided', () => {
    const harvests = [
      { id: 'h1', cropId: 'lettuce', bedId: 'b1', date: '2026-06-15', weight: '2.5', quality: 'A', pricePerKg: '4.00', buyer: '', notes: '' },
      { id: 'h2', cropId: 'tomato', bedId: 'b1', date: '2026-07-20', weight: '5.0', quality: 'B', pricePerKg: '3.50', buyer: 'Market', notes: '' },
    ];
    renderWithContext(<HarvestTab />, { initialState: makeState(harvests), initialUser: makeUser() });
    expect(screen.getByText('7.5 kg')).toBeInTheDocument();
  });

  it('calculates revenue correctly', () => {
    const harvests = [
      { id: 'h1', cropId: 'lettuce', bedId: 'b1', date: '2026-06-15', weight: '2', quality: 'A', pricePerKg: '5', buyer: '', notes: '' },
    ];
    renderWithContext(<HarvestTab />, { initialState: makeState(harvests), initialUser: makeUser() });
    // Revenue = 2 * 5 = 10.00 — look in summary cards
    expect(screen.getAllByText(/10\.00/).length).toBeGreaterThan(0);
  });

  it('shows Quick Log button', () => {
    renderWithContext(<HarvestTab />, { initialState: makeState(), initialUser: makeUser() });
    expect(screen.getByText(/Quick Log/i)).toBeInTheDocument();
  });

  it('opens quick log panel', async () => {
    const user = userEvent.setup();
    renderWithContext(<HarvestTab />, { initialState: makeState(), initialUser: makeUser() });
    await user.click(screen.getByText(/Quick Log/i));
    expect(screen.getByText(/Quick Harvest Log/i)).toBeInTheDocument();
  });

  it('shows monthly chart section', () => {
    const harvests = [
      { id: 'h1', cropId: 'lettuce', bedId: 'b1', date: '2026-06-15', weight: '3', quality: 'A', pricePerKg: '4', buyer: '', notes: '' },
    ];
    renderWithContext(<HarvestTab />, { initialState: makeState(harvests), initialUser: makeUser() });
    expect(screen.getByText(/Monthly Yield/i)).toBeInTheDocument();
  });

  it('shows export report button', () => {
    renderWithContext(<HarvestTab />, { initialState: makeState(), initialUser: makeUser() });
    expect(screen.getByText(/Export Report/i)).toBeInTheDocument();
  });
});
