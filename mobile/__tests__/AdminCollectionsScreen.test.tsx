/**
 * Unit tests for the Admin Collections Management screen (collections.tsx).
 *
 * The screen uses useTimedAsyncData with apiFetch('/health') for loading state,
 * then renders FALLBACK data (metrics, agents, overdue loans, collection logs).
 *
 * IMPORTANT:
 * - All jest.mock factories must NOT reference module-scope variables
 *   (Jest hoists jest.mock calls above all imports and declarations).
 * - RNTL's findByText does EXACT string matching by default.
 *   Use regex (e.g., /Field Agents/) for partial/substring matching.
 * - For duplicate text, use findAllByText / getAllByText.
 */

import React from 'react';
import { render, act, fireEvent } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { ThemeProvider } from '../src/theme';

// ── Wrapper ──

function Wrapper({ children }: { children: React.ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>;
}

// ── Inline mocks ──

jest.mock('expo-router', () => {
  const React = require('react');
  const RN = require('react-native');
  return {
    useRouter: () => ({ back: jest.fn(), push: jest.fn(), replace: jest.fn(), navigate: jest.fn() }),
    useLocalSearchParams: jest.fn(() => ({})),
    useSegments: () => [],
    Link: ({ children, ...props }: any) => React.createElement(RN.Text, props, children),
    Stack: { Screen: ({ children }: any) => children },
    Tabs: { Screen: ({ children }: any) => children },
    default: null,
  };
});

jest.mock('expo-linear-gradient', () => {
  const React = require('react');
  const RN = require('react-native');
  return {
    LinearGradient: ({ style, children, ...props }: any) =>
      React.createElement(RN.View, { style: [{ backgroundColor: '#000' }, style], ...props }, children),
    default: null,
  };
});

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const RN = require('react-native');
  return {
    Ionicons: ({ name, size, color, style, ...props }: any) => {
      const s = [{ fontSize: size || 14, color: color || '#000' }, style];
      return React.createElement(RN.Text, { style: s, ...props }, `[${name}]`);
    },
    default: null,
  };
});

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const RN = require('react-native');
  return {
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
    SafeAreaProvider: ({ children, ...props }: any) =>
      React.createElement(RN.View, props, children),
  };
});

jest.mock('../../src/services/collections', () => ({
  updateCollectionLog: jest.fn().mockResolvedValue({ success: true }),
}));

import AdminCollectionsScreen from '../app/(admin)/collections';

// ── Setup ──

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

// ═══════════════════════════════════════════════════════
// RENDERING TESTS
// ═══════════════════════════════════════════════════════

describe('AdminCollectionsScreen — rendering', () => {
  it('renders the top nav with title', async () => {
    const { findByText } = render(<Wrapper><AdminCollectionsScreen /></Wrapper>);
    await findByText('Collections');
    await findByText('Recovery Operations');
  });

  it('renders the metric cards with unique values', async () => {
    const { findByText } = render(<Wrapper><AdminCollectionsScreen /></Wrapper>);
    await findByText('₹2,16,000');
    await findByText('Collected Today');
    await findByText('₹84,000');
    await findByText('Pending Today');
    await findByText('₹1,42,500');
    await findByText('72%');
    await findByText('Recovery Rate');
  });

  it('renders the tab switcher with three tabs', async () => {
    const { findByText } = render(<Wrapper><AdminCollectionsScreen /></Wrapper>);
    await findByText('Agents');
    await findByText('Logs');
  });
});

// ═══════════════════════════════════════════════════════
// AGENTS TAB
// ═══════════════════════════════════════════════════════

describe('AdminCollectionsScreen — agents tab', () => {
  it('renders agent list with names and collected amounts', async () => {
    const { findByText } = render(<Wrapper><AdminCollectionsScreen /></Wrapper>);
    // These are part of combined text "Field Agents · 5 active" — use regex
    await findByText(/Field Agents/);
    await findByText(/5 active/);

    await findByText('Sunil Verma');
    await findByText('Vikas Yadav');
    await findByText('Anita Sharma');
  });

  it('renders agent collected amounts and targets', async () => {
    const { findByText } = render(<Wrapper><AdminCollectionsScreen /></Wrapper>);
    await findByText('₹32,400');
    await findByText('₹28,800');
  });

  it('shows agent rankings', async () => {
    const { findByText } = render(<Wrapper><AdminCollectionsScreen /></Wrapper>);
    await findByText('#1');
    await findByText('#2');
    await findByText('#3');
  });

  it('shows agent ratings', async () => {
    const { findByText } = render(<Wrapper><AdminCollectionsScreen /></Wrapper>);
    await findByText('4.8');
    await findByText('4.5');
  });

  it('shows agent visit counts', async () => {
    const { findByText } = render(<Wrapper><AdminCollectionsScreen /></Wrapper>);
    await findByText('16/18 visits completed');
    await findByText('14/15 visits completed');
  });

  it('expands agent card with additional info on press', async () => {
    const { findByText, queryByText } = render(<Wrapper><AdminCollectionsScreen /></Wrapper>);
    await findByText('Sunil Verma');
    expect(queryByText('Collection Rate')).toBeNull();

    fireEvent.press(await findByText('Sunil Verma'));
    await findByText('Collection Rate');
    await findByText('Avg per Visit');
    await findByText('Shortfall');
  });

  it('collapses agent card on second press', async () => {
    const { findByText, queryByText } = render(<Wrapper><AdminCollectionsScreen /></Wrapper>);
    await findByText('Sunil Verma');

    fireEvent.press(await findByText('Sunil Verma'));
    await findByText('Collection Rate');

    fireEvent.press(await findByText('Sunil Verma'));
    expect(queryByText('Collection Rate')).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════
// OVERDUE TAB
// ═══════════════════════════════════════════════════════

describe('AdminCollectionsScreen — overdue tab', () => {
  /** Helper: switch to the overdue tab */
  async function switchToOverdueTab(findAllByText: any) {
    // "Overdue" appears twice: metric card label + tab button (both exact match "Overdue")
    const allOverdue = await findAllByText('Overdue');
    fireEvent.press(allOverdue[1]);
  }

  it('switches to overdue tab and shows overdue content', async () => {
    const { findByText, findAllByText } = render(<Wrapper><AdminCollectionsScreen /></Wrapper>);
    await findByText('Agents');

    await switchToOverdueTab(findAllByText);

    // Combined text "Overdue Loans · 5 loans" — use regex
    await findByText(/Overdue Loans/);
    await findByText(/5 loans/);
  });

  it('renders borrower names in overdue tab', async () => {
    const { findByText, findAllByText } = render(<Wrapper><AdminCollectionsScreen /></Wrapper>);
    await switchToOverdueTab(findAllByText);

    await findByText('Ravi Kumar');
    await findByText('Amit Sharma');
    await findByText('Sneha Patel');
  });

  it('shows overdue amounts', async () => {
    const { findByText, findAllByText } = render(<Wrapper><AdminCollectionsScreen /></Wrapper>);
    await switchToOverdueTab(findAllByText);

    await findByText('₹720');
    await findByText('₹1440');
    await findByText('₹600');
  });

  it('shows overdue day badges', async () => {
    const { findByText, findAllByText } = render(<Wrapper><AdminCollectionsScreen /></Wrapper>);
    await switchToOverdueTab(findAllByText);

    await findByText('6d overdue');
    await findByText('12d overdue');
  });

  it('shows risk badges for overdue loans', async () => {
    const { findAllByText } = render(<Wrapper><AdminCollectionsScreen /></Wrapper>);
    await switchToOverdueTab(findAllByText);

    // "high" appears 3 times, "medium" appears 2 times in overdue loan risk badges
    const highBadges = await findAllByText('high');
    expect(highBadges.length).toBe(3);
    const mediumBadges = await findAllByText('medium');
    expect(mediumBadges.length).toBe(2);
  });

  it('shows repayment plan and agent info', async () => {
    const { findByText, findAllByText } = render(<Wrapper><AdminCollectionsScreen /></Wrapper>);
    await switchToOverdueTab(findAllByText);

    // These are part of combined text like "Daily plan · Agent: Sunil Verma"
    const dailyPlans = await findAllByText(/Daily plan/);
    expect(dailyPlans.length).toBeGreaterThanOrEqual(2);
    await findByText(/Agent: Sunil Verma/);
  });
});

// ═══════════════════════════════════════════════════════
// LOGS TAB
// ═══════════════════════════════════════════════════════

describe('AdminCollectionsScreen — logs tab', () => {
  it('switches to logs tab and renders collection logs', async () => {
    const { findByText } = render(<Wrapper><AdminCollectionsScreen /></Wrapper>);
    await findByText('Agents');

    const logsTab = await findByText('Logs');
    fireEvent.press(logsTab);

    // Combined text "Collection Logs · 7 entries" — use regex
    await findByText(/Collection Logs/);
    await findByText(/7 entries/);
  });

  it('renders log type labels', async () => {
    const { findByText, findAllByText } = render(<Wrapper><AdminCollectionsScreen /></Wrapper>);
    const logsTab = await findByText('Logs');
    fireEvent.press(logsTab);

    await findByText('Home Visit');
    const phoneCalls = await findAllByText('Phone Call');
    expect(phoneCalls.length).toBe(2);
    await findByText('SMS Reminder');
  });

  it('shows status and outcome badges on logs', async () => {
    const { findByText, findAllByText } = render(<Wrapper><AdminCollectionsScreen /></Wrapper>);
    const logsTab = await findByText('Logs');
    fireEvent.press(logsTab);

    // "Completed" appears on 4 log status badges
    const completedBadges = await findAllByText('Completed');
    expect(completedBadges.length).toBeGreaterThanOrEqual(4);

    await findByText('In Progress');
    await findByText('Scheduled');

    await findByText('Full Payment');
    const promises = await findAllByText('Promise to Pay');
    expect(promises.length).toBeGreaterThanOrEqual(1);
    await findByText('No Response');
  });
});

// ═══════════════════════════════════════════════════════
// LOG DETAIL VIEW
// ═══════════════════════════════════════════════════════

describe('AdminCollectionsScreen — log detail view', () => {
  /** Helper: switch to logs tab and open the first log (Home Visit) */
  async function openHomeVisitDetail(findByText: any) {
    const logsTab = await findByText('Logs');
    fireEvent.press(logsTab);
    await findByText(/Collection Logs/);
    const homeVisit = await findByText('Home Visit');
    fireEvent.press(homeVisit);
  }

  it('opens detail view when tapping a log', async () => {
    const { findByText } = render(<Wrapper><AdminCollectionsScreen /></Wrapper>);
    await openHomeVisitDetail(findByText);

    await findByText('Back to logs');
    await findByText(/Loan #101/);
    await findByText('₹720');
  });

  it('shows outcome and contact info in log detail', async () => {
    const { findByText, findAllByText } = render(<Wrapper><AdminCollectionsScreen /></Wrapper>);
    const logsTab = await findByText('Logs');
    fireEvent.press(logsTab);

    const phoneCalls = await findAllByText('Phone Call');
    fireEvent.press(phoneCalls[0]);

    await findByText(/Loan #102/);
    const outcomes = await findAllByText('Outcome');
    expect(outcomes.length).toBeGreaterThanOrEqual(1);
    const promises = await findAllByText('Promise to Pay');
    expect(promises.length).toBeGreaterThanOrEqual(1);
    await findByText('Amount Promised');
  });

  it('returns to logs list when back button is pressed', async () => {
    const { findByText } = render(<Wrapper><AdminCollectionsScreen /></Wrapper>);
    await openHomeVisitDetail(findByText);

    const back = await findByText('Back to logs');
    fireEvent.press(back);

    await findByText(/7 entries/);
  });

  it('shows Edit Log button in detail view', async () => {
    const { findByText } = render(<Wrapper><AdminCollectionsScreen /></Wrapper>);
    await openHomeVisitDetail(findByText);

    await findByText('Edit Log');
  });
});

// ═══════════════════════════════════════════════════════
// LOG EDIT MODE
// ═══════════════════════════════════════════════════════

describe('AdminCollectionsScreen — log edit mode', () => {
  /** Helper: open home visit detail and enter edit mode */
  async function enterEditMode(findByText: any, getByPlaceholderText: any) {
    const logsTab = await findByText('Logs');
    fireEvent.press(logsTab);
    await findByText(/Collection Logs/);

    const homeVisit = await findByText('Home Visit');
    fireEvent.press(homeVisit);

    const editBtn = await findByText('Edit Log');
    fireEvent.press(editBtn);

    await findByText('Save Changes');
    await findByText('Cancel');
    expect(getByPlaceholderText('Enter amount collected')).toBeTruthy();
  }

  it('enters edit mode when Edit Log is pressed', async () => {
    const { findByText, getByPlaceholderText } = render(<Wrapper><AdminCollectionsScreen /></Wrapper>);
    await enterEditMode(findByText, getByPlaceholderText);
  });

  it('shows picker pills for status in edit mode', async () => {
    const { findByText, getByPlaceholderText } = render(<Wrapper><AdminCollectionsScreen /></Wrapper>);
    await enterEditMode(findByText, getByPlaceholderText);

    await findByText('Scheduled');
    await findByText('In Progress');
    await findByText('Skipped');
    await findByText('Cancelled');
  });

  it('shows outcome picker pills in edit mode', async () => {
    const { findByText, getByPlaceholderText } = render(<Wrapper><AdminCollectionsScreen /></Wrapper>);
    await enterEditMode(findByText, getByPlaceholderText);

    await findByText('Partial Payment');
    await findByText('Refused');
    await findByText('Deceased');
  });

  it('allows editing notes field', async () => {
    const { findByText, getByPlaceholderText } = render(<Wrapper><AdminCollectionsScreen /></Wrapper>);
    await enterEditMode(findByText, getByPlaceholderText);

    const notesInput = getByPlaceholderText('Add notes...');
    fireEvent.changeText(notesInput, 'Updated notes');
    expect(notesInput.props.value).toBe('Updated notes');
  });

  it('cancels edit mode and restores view', async () => {
    const { findByText, getByPlaceholderText, queryByText } = render(<Wrapper><AdminCollectionsScreen /></Wrapper>);
    await enterEditMode(findByText, getByPlaceholderText);

    const cancel = await findByText('Cancel');
    fireEvent.press(cancel);

    await findByText('Edit Log');
    expect(queryByText('Save Changes')).toBeNull();
  });

  it('saves changes and calls updateCollectionLog', async () => {
    const collections = require('../../src/services/collections') as jest.Mocked<typeof import('../../src/services/collections')>;
    collections.updateCollectionLog.mockResolvedValue({ success: true });

    const { findByText, getByPlaceholderText } = render(<Wrapper><AdminCollectionsScreen /></Wrapper>);
    await enterEditMode(findByText, getByPlaceholderText);

    const notesInput = getByPlaceholderText('Add notes...');
    fireEvent.changeText(notesInput, 'Updated notes');

    const saveBtn = await findByText('Save Changes');
    await act(async () => { fireEvent.press(saveBtn); });

    expect(collections.updateCollectionLog).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ notes: 'Updated notes' }),
    );
  });

  it('shows success alert on successful save', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    const collections = require('../../src/services/collections') as jest.Mocked<typeof import('../../src/services/collections')>;
    collections.updateCollectionLog.mockResolvedValue({ success: true });

    const { findByText, getByPlaceholderText } = render(<Wrapper><AdminCollectionsScreen /></Wrapper>);
    await enterEditMode(findByText, getByPlaceholderText);

    const saveBtn = await findByText('Save Changes');
    await act(async () => { fireEvent.press(saveBtn); });

    expect(alertSpy).toHaveBeenCalledWith('Saved', expect.stringContaining('Collection log updated'));
  });

  it('shows error alert when save fails', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    const collections = require('../../src/services/collections') as jest.Mocked<typeof import('../../src/services/collections')>;
    collections.updateCollectionLog.mockResolvedValue({ success: false, error: 'DB error' });

    const { findByText, getByPlaceholderText } = render(<Wrapper><AdminCollectionsScreen /></Wrapper>);
    await enterEditMode(findByText, getByPlaceholderText);

    const saveBtn = await findByText('Save Changes');
    await act(async () => { fireEvent.press(saveBtn); });

    expect(alertSpy).toHaveBeenCalledWith('Error', expect.stringContaining('DB error'));
  });

  it('toggles between tabs and resets log selection', async () => {
    const { findByText, queryByText } = render(<Wrapper><AdminCollectionsScreen /></Wrapper>);
    const logsTab = await findByText('Logs');
    fireEvent.press(logsTab);

    const homeVisit = await findByText('Home Visit');
    fireEvent.press(homeVisit);

    const agentsTab = await findByText('Agents');
    fireEvent.press(agentsTab);

    await findByText('Sunil Verma');

    fireEvent.press(await findByText('Logs'));
    await findByText(/7 entries/);
    expect(queryByText('Back to logs')).toBeNull();
  });
});
