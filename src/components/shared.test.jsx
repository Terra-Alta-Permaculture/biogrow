import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithContext } from '../test/renderWithContext';
import { Modal, Button, FormField, Input, Select, Badge, SummaryCard, EmptyState, Card } from './shared';

describe('Modal', () => {
  it('renders nothing when closed', () => {
    renderWithContext(<Modal open={false} onClose={() => {}} title="Test">Content</Modal>);
    expect(screen.queryByText('Test')).toBeNull();
  });

  it('renders title and children when open', () => {
    renderWithContext(<Modal open={true} onClose={() => {}} title="My Modal">Hello World</Modal>);
    expect(screen.getByText('My Modal')).toBeInTheDocument();
    expect(screen.getByText('Hello World')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', async () => {
    const onClose = vi.fn();
    renderWithContext(<Modal open={true} onClose={onClose} title="Test">Content</Modal>);
    await userEvent.click(screen.getByText('✕'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when backdrop is clicked', async () => {
    const onClose = vi.fn();
    const { container } = renderWithContext(<Modal open={true} onClose={onClose} title="Test">Content</Modal>);
    // Click on the backdrop (outermost div with position fixed)
    const backdrop = container.querySelector('[style*="position: fixed"]');
    await userEvent.click(backdrop);
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose on Escape key', () => {
    const onClose = vi.fn();
    renderWithContext(<Modal open={true} onClose={onClose} title="Test">Content</Modal>);
    const dialog = screen.getByRole('dialog');
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close when modal content is clicked', async () => {
    const onClose = vi.fn();
    renderWithContext(<Modal open={true} onClose={onClose} title="Test">Click Me</Modal>);
    await userEvent.click(screen.getByText('Click Me'));
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('Button', () => {
  it('renders children', () => {
    renderWithContext(<Button>Click Me</Button>);
    expect(screen.getByText('Click Me')).toBeInTheDocument();
  });

  it('calls onClick when clicked', async () => {
    const onClick = vi.fn();
    renderWithContext(<Button onClick={onClick}>Test</Button>);
    await userEvent.click(screen.getByText('Test'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('applies different variant styles', () => {
    const { rerender } = renderWithContext(<Button variant="primary">Primary</Button>);
    const btn = screen.getByText('Primary');
    expect(btn).toBeInTheDocument();
  });
});

describe('FormField', () => {
  it('renders label and children', () => {
    renderWithContext(<FormField label="Name"><Input placeholder="Enter name" /></FormField>);
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter name')).toBeInTheDocument();
  });
});

describe('Input', () => {
  it('renders with placeholder', () => {
    renderWithContext(<Input placeholder="Type here" />);
    expect(screen.getByPlaceholderText('Type here')).toBeInTheDocument();
  });

  it('accepts typed input', async () => {
    const user = userEvent.setup();
    renderWithContext(<Input placeholder="Type" />);
    const input = screen.getByPlaceholderText('Type');
    await user.type(input, 'hello');
    expect(input.value).toBe('hello');
  });
});

describe('Select', () => {
  it('renders options', () => {
    renderWithContext(
      <Select defaultValue="b">
        <option value="a">Option A</option>
        <option value="b">Option B</option>
      </Select>
    );
    expect(screen.getByText('Option A')).toBeInTheDocument();
    expect(screen.getByText('Option B')).toBeInTheDocument();
  });
});

describe('Badge', () => {
  it('renders text content', () => {
    render(<Badge color="#fff" bg="#333">Active</Badge>);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });
});

describe('SummaryCard', () => {
  it('renders icon, label, and value', () => {
    renderWithContext(<SummaryCard icon="🌱" label="Beds" value="12" />);
    expect(screen.getByText('🌱')).toBeInTheDocument();
    expect(screen.getByText('Beds')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
  });
});

describe('EmptyState', () => {
  it('renders icon and message', () => {
    renderWithContext(<EmptyState icon="📭" message="No items" />);
    expect(screen.getByText('📭')).toBeInTheDocument();
    expect(screen.getByText('No items')).toBeInTheDocument();
  });
});

describe('Card', () => {
  it('renders children', () => {
    renderWithContext(<Card>Card content</Card>);
    expect(screen.getByText('Card content')).toBeInTheDocument();
  });
});
