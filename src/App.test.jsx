import { describe, it, expect, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import App from './App';
import { render } from '@testing-library/react';
import { makeUser } from './test/renderWithContext';

beforeEach(() => {
  localStorage.clear();
  globalThis.IntersectionObserver = class {
    constructor(cb) { this._cb = cb; }
    observe() {}
    disconnect() {}
  };
});

describe('App', () => {
  it('renders without crashing', () => {
    render(<App />);
    expect(document.body).toBeDefined();
  });

  it('shows auth screen when no user is logged in', () => {
    render(<App />);
    // AuthScreen has a "Create Account" button
    expect(screen.getAllByText(/Create Account/i).length).toBeGreaterThan(0);
  });

  it('shows main app when user is logged in', () => {
    localStorage.setItem('biogrow-auth', JSON.stringify(makeUser()));
    render(<App />);
    // Footer always shows this text
    expect(screen.getByText(/Pedro Valdjiu/i)).toBeInTheDocument();
  });

  it('renders skip to content link', () => {
    localStorage.setItem('biogrow-auth', JSON.stringify(makeUser()));
    render(<App />);
    expect(screen.getByText(/Skip to content/i)).toBeInTheDocument();
  });

  it('renders main content area with tabpanel role', () => {
    localStorage.setItem('biogrow-auth', JSON.stringify(makeUser()));
    render(<App />);
    expect(screen.getByRole('tabpanel')).toBeInTheDocument();
  });

  it('renders footer', () => {
    localStorage.setItem('biogrow-auth', JSON.stringify(makeUser()));
    render(<App />);
    expect(screen.getByText(/Pedro Valdjiu/i)).toBeInTheDocument();
    expect(screen.getByText(/Terra Alta/i)).toBeInTheDocument();
  });

  it('renders disclaimer button in footer', () => {
    localStorage.setItem('biogrow-auth', JSON.stringify(makeUser()));
    render(<App />);
    expect(screen.getByText(/Disclaimer/i)).toBeInTheDocument();
  });
});
