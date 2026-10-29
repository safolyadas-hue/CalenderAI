import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import App from '../App';

describe('App Integration & WCAG 2.1 AA Accessibility Tests', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders WCAG 2.1 AA accessibility primitives and semantic landmarks', () => {
    render(<App />);

    // 1. Skip to main content link
    const skipLink = screen.getByRole('link', { name: /skip to main content/i });
    expect(skipLink).toBeInTheDocument();
    expect(skipLink).toHaveAttribute('href', '#main-content');

    // 2. Semantic landmarks
    const header = screen.getByRole('banner');
    expect(header).toBeInTheDocument();

    const main = screen.getByRole('main');
    expect(main).toBeInTheDocument();
    expect(main).toHaveAttribute('id', 'main-content');

    const nav = screen.getByRole('navigation', { name: /event verticals/i });
    expect(nav).toBeInTheDocument();

    // 3. Progressbar for budget distribution
    const progressbar = screen.getByRole('progressbar', { name: /budget allocation distribution/i });
    expect(progressbar).toBeInTheDocument();
    expect(progressbar).toHaveAttribute('aria-valuenow', '100');
  });

  it('switches vertical personas dynamically and rebalances budget categories and vendor checklist', async () => {
    render(<App />);

    // Initial state: Wedding vertical
    expect(screen.getByText(/WEDDING PLANNER/i)).toBeInTheDocument();
    expect(screen.getByText(/Venue Coordinator/i)).toBeInTheDocument();

    // Switch to Birthday persona
    const nav = screen.getByRole('navigation', { name: /event verticals/i });
    const birthdayBtn = within(nav).getByRole('button', { name: /birthday/i });
    fireEvent.click(birthdayBtn);

    // Context banner updates
    expect(screen.getByText(/BIRTHDAY PLANNER/i)).toBeInTheDocument();

    // Vendors recalculated for Birthday (e.g. Cake Designer)
    expect(screen.getByText(/Cake Designer/i)).toBeInTheDocument();

    // Switch to Community Event persona
    const communityBtn = within(nav).getByRole('button', { name: /community/i });
    fireEvent.click(communityBtn);

    // Context banner updates
    expect(screen.getByText(/COMMUNITY PLANNER/i)).toBeInTheDocument();

    // Vendors recalculated for Community Event (e.g. AV Technician)
    expect(screen.getByText(/AV Technician/i)).toBeInTheDocument();
  });

  it('triggers compressed timeline urgency mode when clicking "14-Day Sprint"', async () => {
    render(<App />);

    // Click the 14-Day Sprint button
    const sprintBtn = screen.getByRole('button', { name: /14-Day Sprint/i });
    expect(sprintBtn).toBeInTheDocument();
    fireEvent.click(sprintBtn);

    // Verify timeline urgency mode indicator in the Timeline header or badge
    // In TimelineScheduler: with <= 30 days, "Accelerated Sprint (< 30 Days)" badge or warning appears
    const urgentBadge = await screen.findByText(/Accelerated Sprint/i);
    expect(urgentBadge).toBeInTheDocument();
  });

  it('allows loading presets from evaluator dropdown', async () => {
    render(<App />);

    const presetSelect = screen.getByLabelText(/load preset scenario/i);
    expect(presetSelect).toBeInTheDocument();

    // Select Birthday Preset (index 1)
    fireEvent.change(presetSelect, { target: { value: '1' } });

    expect(screen.getByText(/BIRTHDAY PLANNER/i)).toBeInTheDocument();
  });
});
