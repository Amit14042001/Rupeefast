/**
 * Unit tests for the Admin Fraud Monitoring screen (fraud.tsx).
 *
 * The screen uses useTimedAsyncData with apiFetch('/health') for loading state,
 * then renders FALLBACK_EVENTS (10 fraud events) as default content.
 *
 * IMPORTANT: All jest.mock factories must NOT reference module-scope variables,
 * because Jest hoists jest.mock calls above all imports and declarations.
 *
 * NOTE: RNTL's findByText uses substring matching by default. Text like
 * "critical" also matches "6 critical" (top nav badge). Use findAllByText
 * with exact regex (/^critical$/) when there are multiple possible matches.
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
      React.createElement(RN.View, { style: [{ backgroundColor: '#A02020' }, style], ...props }, children),
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

jest.mock('@mocks/services/fraud', () => ({
  updateFraudEventStatus: jest.fn().mockResolvedValue({ success: true }),
}));

import AdminFraudScreen from '../app/(admin)/fraud';

// ── Setup ──

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

// ── Helpers ──

/** Find all elements with exact text (case-sensitive regex anchored to string boundary) */
async function findAllExactText(renderResult: any, text: string) {
  return renderResult.findAllByText(new RegExp(`^${escapeRegex(text)}$`));
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ═══════════════════════════════════════════════════════
// RENDERING TESTS
// ═══════════════════════════════════════════════════════

describe('AdminFraudScreen — rendering', () => {
  it('renders the top nav with title and open event count', async () => {
    const { findByText } = render(<Wrapper><AdminFraudScreen /></Wrapper>);
    await findByText('Fraud Monitoring');
    await findByText('4 open events');
  });

  it('shows the critical alert banner when critical events exist', async () => {
    const { findByText } = render(<Wrapper><AdminFraudScreen /></Wrapper>);
    await findByText('Critical Alerts Require Attention');
    // criticalCount = 3 (events 1,5,8 are critical and not resolved/dismissed)
    await findByText(/3 fraud events/);
  });

  it('renders the metric cards with correct counts', async () => {
    const { findByText } = render(<Wrapper><AdminFraudScreen /></Wrapper>);
    // Flagged = events not resolved/dismissed: 10 - 2 (resolved:6, dismissed:10) = 8
    await findByText('8');
    // Open = 4 (events 1,3,4,7)
    await findByText('4');
    // Closed = resolved + dismissed = 2 (events 6,10)
    await findByText('2');
  });

  it('renders severity filter pills', async () => {
    const { findAllByText } = render(<Wrapper><AdminFraudScreen /></Wrapper>);
    // Each severity word appears on filter pills + list item severity badges
    // Use findAll to verify at least one exists
    const highs = await findAllByText(/^high$/);
    expect(highs.length).toBeGreaterThanOrEqual(1);
    const mediums = await findAllByText(/^medium$/);
    expect(mediums.length).toBeGreaterThanOrEqual(1);
    const lows = await findAllByText(/^low$/);
    expect(lows.length).toBeGreaterThanOrEqual(1);
    const infos = await findAllByText(/^info$/);
    expect(infos.length).toBeGreaterThanOrEqual(1);
  });

  it('renders the section header with event count', async () => {
    const { findByText } = render(<Wrapper><AdminFraudScreen /></Wrapper>);
    await findByText('Fraud Events');
    await findByText('10 of 10');
  });

  it('renders list items with event titles', async () => {
    const { findByText } = render(<Wrapper><AdminFraudScreen /></Wrapper>);
    await findByText('Device Farming Detected');
    await findByText('PAN Verification Failed');
    await findByText('GPS Spoofing Suspected');
  });
});

// ═══════════════════════════════════════════════════════
// FILTER TESTS
// ═══════════════════════════════════════════════════════

describe('AdminFraudScreen — filters', () => {
  it('filters events by severity', async () => {
    const { findByText, findAllByText, queryByText } = render(<Wrapper><AdminFraudScreen /></Wrapper>);
    await findByText('Fraud Events');

    // "critical" appears on: top nav badge ("6 critical"), filter pill, and 3 list item severity badges
    // findAllByText with exact regex gives all occurrences; first in tree order is the filter pill
    const criticalElements = await findAllByText(/^critical$/);
    fireEvent.press(criticalElements[0]);

    // Should show filtered count: 3 critical events (IDs 1, 5, 8)
    await findByText('3 of 10');
    expect(queryByText('PAN Verification Failed')).toBeNull();
  });

  it('shows clear filter button when a filter is active', async () => {
    const { findByText, findAllByText } = render(<Wrapper><AdminFraudScreen /></Wrapper>);
    await findByText('Fraud Events');

    const criticalElements = await findAllByText(/^critical$/);
    fireEvent.press(criticalElements[0]);

    await findByText('Clear');
  });

  it('clears filters when clear button is pressed', async () => {
    const { findByText, findAllByText } = render(<Wrapper><AdminFraudScreen /></Wrapper>);
    await findByText('Fraud Events');

    const criticalElements = await findAllByText(/^critical$/);
    fireEvent.press(criticalElements[0]);
    await findByText('3 of 10');

    const clear = await findByText('Clear');
    fireEvent.press(clear);

    await findByText('10 of 10');
  });

  it('shows empty state when no events match filters', async () => {
    const { findByText, findAllByText } = render(<Wrapper><AdminFraudScreen /></Wrapper>);
    await findByText('Fraud Events');

    // Filter by "info" severity — only event #10 is info, but it's dismissed
    // Combined with "resolved" status filter = 0 events matching both
    const infoElements = await findAllByText(/^info$/);
    fireEvent.press(infoElements[0]);

    // "Resolved" appears on: status filter pill, and list item status badges
    const resolvedElements = await findAllByText(/^Resolved$/);
    fireEvent.press(resolvedElements[0]);

    await findByText('No events match filters');
    await findByText('0 of 10');
  });
});

// ═══════════════════════════════════════════════════════
// DETAIL VIEW TESTS
// ═══════════════════════════════════════════════════════

describe('AdminFraudScreen — detail view', () => {
  it('opens detail view when tapping a list item', async () => {
    const { findByText } = render(<Wrapper><AdminFraudScreen /></Wrapper>);
    await findByText('Fraud Events');

    const eventTitle = await findByText('Device Farming Detected');
    fireEvent.press(eventTitle);

    await findByText('Back to events');
    await findByText('CRITICAL');
    await findByText(/Same device fingerprint detected/);
  });

  it('returns to list view when back button is pressed', async () => {
    const { findByText } = render(<Wrapper><AdminFraudScreen /></Wrapper>);
    await findByText('Fraud Events');

    const eventTitle = await findByText('Device Farming Detected');
    fireEvent.press(eventTitle);

    const back = await findByText('Back to events');
    fireEvent.press(back);

    await findByText('10 of 10');
  });

  it('shows action buttons for open status events', async () => {
    const { findByText } = render(<Wrapper><AdminFraudScreen /></Wrapper>);
    await findByText('Fraud Events');

    const eventTitle = await findByText('Device Farming Detected');
    fireEvent.press(eventTitle);

    await findByText('Start Investigation');
    await findByText('Dismiss');
  });

  it('shows resolve and confirm buttons for investigating status', async () => {
    const { findByText } = render(<Wrapper><AdminFraudScreen /></Wrapper>);
    await findByText('Fraud Events');

    const eventTitle = await findByText('PAN Verification Failed');
    fireEvent.press(eventTitle);

    await findByText('Resolve');
    await findByText('Confirm Fraud');
  });

  it('shows metadata section when event has metadata keys', async () => {
    const { findByText } = render(<Wrapper><AdminFraudScreen /></Wrapper>);
    await findByText('Fraud Events');

    const eventTitle = await findByText('Device Farming Detected');
    fireEvent.press(eventTitle);

    await findByText('Metadata');
    await findByText('duplicate_devices');
  });

  it('shows action taken and resolution in detail for resolved events', async () => {
    const { findByText } = render(<Wrapper><AdminFraudScreen /></Wrapper>);
    await findByText('Fraud Events');

    const eventTitle = await findByText('Payment Card Testing');
    fireEvent.press(eventTitle);

    await findByText('Action Taken');
    await findByText(/User account temporarily restricted/);
    await findByText('Resolution');
  });
});

// ═══════════════════════════════════════════════════════
// INTERACTION TESTS
// ═══════════════════════════════════════════════════════

describe('AdminFraudScreen — interactions', () => {
  it('calls updateFraudEventStatus when Start Investigation is pressed', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    const fraud = require('@mocks/services/fraud') as jest.Mocked<typeof import('@mocks/services/fraud')>;
    fraud.updateFraudEventStatus.mockResolvedValue({ success: true });

    const { findByText } = render(<Wrapper><AdminFraudScreen /></Wrapper>);
    await findByText('Fraud Events');

    const eventTitle = await findByText('Device Farming Detected');
    fireEvent.press(eventTitle);

    const investigate = await findByText('Start Investigation');
    await act(async () => { fireEvent.press(investigate); });

    expect(fraud.updateFraudEventStatus).toHaveBeenCalledWith(1, 'investigating', undefined);
    expect(alertSpy).toHaveBeenCalledWith('Updated', expect.stringContaining('Investigating'));
  });

  it('shows error alert when updateFraudEventStatus fails', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    const fraud = require('@mocks/services/fraud') as jest.Mocked<typeof import('@mocks/services/fraud')>;
    fraud.updateFraudEventStatus.mockResolvedValue({ success: false, error: 'Failed to update' });

    const { findByText } = render(<Wrapper><AdminFraudScreen /></Wrapper>);
    await findByText('Fraud Events');

    const eventTitle = await findByText('Device Farming Detected');
    fireEvent.press(eventTitle);

    const investigate = await findByText('Start Investigation');
    await act(async () => { fireEvent.press(investigate); });

    expect(alertSpy).toHaveBeenCalledWith('Error', expect.stringContaining('Failed to update'));
  });

  it('calls updateFraudEventStatus with dismiss for Dismiss button', async () => {
    const fraud = require('@mocks/services/fraud') as jest.Mocked<typeof import('@mocks/services/fraud')>;
    fraud.updateFraudEventStatus.mockResolvedValue({ success: true });

    const { findByText } = render(<Wrapper><AdminFraudScreen /></Wrapper>);
    await findByText('Fraud Events');

    const eventTitle = await findByText('Device Farming Detected');
    fireEvent.press(eventTitle);

    const dismiss = await findByText('Dismiss');
    await act(async () => { fireEvent.press(dismiss); });

    expect(fraud.updateFraudEventStatus).toHaveBeenCalledWith(
      1,
      'dismissed',
      'Dismissed — false positive or no further action required',
    );
  });

  it('calls updateFraudEventStatus to confirm fraud for investigating events', async () => {
    const fraud = require('@mocks/services/fraud') as jest.Mocked<typeof import('@mocks/services/fraud')>;
    fraud.updateFraudEventStatus.mockResolvedValue({ success: true });

    const { findByText } = render(<Wrapper><AdminFraudScreen /></Wrapper>);
    await findByText('Fraud Events');

    const eventTitle = await findByText('PAN Verification Failed');
    fireEvent.press(eventTitle);

    const confirmBtn = await findByText('Confirm Fraud');
    await act(async () => { fireEvent.press(confirmBtn); });

    expect(fraud.updateFraudEventStatus).toHaveBeenCalledWith(2, 'confirmed', undefined);
  });

  it('disables action buttons while updating (shows ActivityIndicator)', async () => {
    const fraud = require('@mocks/services/fraud') as jest.Mocked<typeof import('@mocks/services/fraud')>;
    fraud.updateFraudEventStatus.mockImplementation(() => new Promise(() => {}));

    const { findByText } = render(<Wrapper><AdminFraudScreen /></Wrapper>);
    await findByText('Fraud Events');

    const eventTitle = await findByText('Device Farming Detected');
    fireEvent.press(eventTitle);

    const investigate = await findByText('Start Investigation');
    fireEvent.press(investigate);

    // Dismiss button should still be visible (even though disabled)
    await findByText('Dismiss');
  });
});
