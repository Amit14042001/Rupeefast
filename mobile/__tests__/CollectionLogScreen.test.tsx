/**
 * Unit tests for the Agent Collection Log screen (collection-log.tsx).
 *
 * IMPORTANT: All `jest.mock` factories must NOT reference module-scope variables,
 * because Jest hoists `jest.mock` calls above all imports and declarations.
 * Use `jest.fn()` inline in the factory, then retrieve mocks via `require()`
 * in `beforeEach` for per-test customization.
 */

import React from 'react';
import { render, act, fireEvent } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { ThemeProvider } from '../src/theme';

// ── Wrapper component providing all required context ──

function Wrapper({ children }: { children: React.ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>;
}

// ── Inline mocks (no module-scope variable references inside factories) ──

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
  createCollectionLog: jest.fn().mockResolvedValue({ success: true, logId: 42 }),
  updateCollectionLog: jest.fn().mockResolvedValue({ success: true }),
}));

import AgentCollectionLogScreen from '../app/(agent)/collection-log';

// ── Setup ──

beforeEach(() => {
  jest.clearAllMocks();
  const expoRouter = require('expo-router') as jest.Mocked<typeof import('expo-router')>;
  expoRouter.useLocalSearchParams = jest.fn(() => ({})) as any;
  const collections = require('../../src/services/collections') as jest.Mocked<typeof import('../../src/services/collections')>;
  collections.createCollectionLog.mockResolvedValue({ success: true, logId: 42 });
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

// ═══════════════════════════════════════════════════════
// RENDERING TESTS
// ═══════════════════════════════════════════════════════

describe('CollectionLogScreen — rendering', () => {
  it('renders the top nav with title', async () => {
    const { findByText } = render(<Wrapper><AgentCollectionLogScreen /></Wrapper>);
    await findByText('Log Collection');
  });

  it('shows section headers', async () => {
    const { findByText } = render(<Wrapper><AgentCollectionLogScreen /></Wrapper>);
    await findByText('Collection Type');
    await findByText('Contact Details');
    await findByText('Outcome');
    await findByText('Location & Time');
    await findByText('Notes');
  });

  it('displays the borrower name when passed via route params', async () => {
    const expoRouter = require('expo-router');
    expoRouter.useLocalSearchParams = jest.fn(() => ({ loanId: '5', borrowerName: 'Ravi K.' })) as any;
    const { findByText } = render(<Wrapper><AgentCollectionLogScreen /></Wrapper>);
    await findByText('Ravi K.');
  });

  it('renders all collection type pills', async () => {
    const { findByText } = render(<Wrapper><AgentCollectionLogScreen /></Wrapper>);
    await findByText('Field Visit');
    await findByText('Phone Call');
    await findByText('SMS Reminder');
    await findByText('Home Visit');
  });

  it('renders all outcome pills', async () => {
    const { findByText } = render(<Wrapper><AgentCollectionLogScreen /></Wrapper>);
    await findByText('Full Payment');
    await findByText('No Response');
    await findByText('Promise to Pay');
    await findByText('Not Home');
  });

  it('renders the submit and reset buttons', async () => {
    const { findByText } = render(<Wrapper><AgentCollectionLogScreen /></Wrapper>);
    await findByText('Save Collection Log');
    await findByText('Reset Form');
  });

  it('renders GPS and duration input fields', () => {
    const { getByPlaceholderText } = render(<Wrapper><AgentCollectionLogScreen /></Wrapper>);
    expect(getByPlaceholderText('28.6139')).toBeTruthy();
    expect(getByPlaceholderText('77.2090')).toBeTruthy();
    expect(getByPlaceholderText('e.g. 15')).toBeTruthy();
  });

  it('renders the notes textarea', () => {
    const { getByPlaceholderText } = render(<Wrapper><AgentCollectionLogScreen /></Wrapper>);
    expect(getByPlaceholderText(/Add any additional notes/)).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════
// CONDITIONAL FIELD TESTS
// ═══════════════════════════════════════════════════════

describe('CollectionLogScreen — conditional fields', () => {
  it('shows amount collected field when Full Payment outcome is selected', async () => {
    const { findByText, getByPlaceholderText } = render(<Wrapper><AgentCollectionLogScreen /></Wrapper>);
    const fullPayment = await findByText('Full Payment');
    fireEvent.press(fullPayment);
    expect(getByPlaceholderText('e.g. 120')).toBeTruthy();
  });

  it('shows amount collected field when Partial Payment outcome is selected', async () => {
    const { findByText, queryByPlaceholderText } = render(<Wrapper><AgentCollectionLogScreen /></Wrapper>);
    const partialPayment = await findByText('Partial Payment');
    fireEvent.press(partialPayment);
    expect(queryByPlaceholderText('e.g. 120')).toBeTruthy();
  });

  it('shows amount promised and promise date when Promise to Pay is selected', async () => {
    const { findByText, getByPlaceholderText } = render(<Wrapper><AgentCollectionLogScreen /></Wrapper>);
    const promise = await findByText('Promise to Pay');
    fireEvent.press(promise);
    expect(getByPlaceholderText('e.g. 120')).toBeTruthy();
    expect(getByPlaceholderText('YYYY-MM-DD (e.g. 2025-07-05)')).toBeTruthy();
  });

  it('hides payment amount field when switching from payment to non-payment outcome', async () => {
    const { findByText, queryByPlaceholderText } = render(<Wrapper><AgentCollectionLogScreen /></Wrapper>);
    const fullPayment = await findByText('Full Payment');
    fireEvent.press(fullPayment);
    expect(queryByPlaceholderText('e.g. 120')).toBeTruthy();

    const noResponse = await findByText('No Response');
    fireEvent.press(noResponse);
    expect(queryByPlaceholderText('e.g. 120')).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════
// GPS BADGE TESTS
// ═══════════════════════════════════════════════════════

describe('CollectionLogScreen — GPS capture', () => {
  it('shows GPS captured badge when lat/lng are entered', async () => {
    const { findByText, getByPlaceholderText } = render(<Wrapper><AgentCollectionLogScreen /></Wrapper>);
    const latInput = getByPlaceholderText('28.6139');
    const lngInput = getByPlaceholderText('77.2090');
    fireEvent.changeText(latInput, '28.6139');
    fireEvent.changeText(lngInput, '77.2090');
    await findByText('GPS Captured');
  });
});

// ═══════════════════════════════════════════════════════
// SUBMIT TESTS
// ═══════════════════════════════════════════════════════

describe('CollectionLogScreen — submit', () => {
  it('shows validation alert when collection type is not selected', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    const { findByText } = render(<Wrapper><AgentCollectionLogScreen /></Wrapper>);
    const submit = await findByText('Save Collection Log');
    fireEvent.press(submit);
    expect(alertSpy).toHaveBeenCalledWith('Required', expect.stringContaining('collection type'));
  });

  it('shows validation alert when outcome is not selected', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    const { findByText } = render(<Wrapper><AgentCollectionLogScreen /></Wrapper>);
    const fieldVisit = await findByText('Field Visit');
    fireEvent.press(fieldVisit);
    const submit = await findByText('Save Collection Log');
    fireEvent.press(submit);
    expect(alertSpy).toHaveBeenCalledWith('Required', expect.stringContaining('outcome'));
  });

  it('calls createCollectionLog with correct data on valid submit', async () => {
    const expoRouter = require('expo-router');
    expoRouter.useLocalSearchParams = jest.fn(() => ({ loanId: '5', borrowerName: 'Ravi K.' })) as any;
    const collections = require('../../src/services/collections');
    collections.createCollectionLog.mockResolvedValueOnce({ success: true, logId: 42 });

    const { findByText, getByPlaceholderText } = render(<Wrapper><AgentCollectionLogScreen /></Wrapper>);
    fireEvent.press(await findByText('Field Visit'));
    fireEvent.press(await findByText('Full Payment'));
    fireEvent.changeText(getByPlaceholderText('28.6139'), '28.6139');
    fireEvent.changeText(getByPlaceholderText('77.2090'), '77.2090');
    fireEvent.changeText(getByPlaceholderText('e.g. 120'), '150');

    const submit = await findByText('Save Collection Log');
    await act(async () => { fireEvent.press(submit); });

    expect(collections.createCollectionLog).toHaveBeenCalledWith(
      expect.objectContaining({
        loan_id: 5,
        collection_type: 'field_visit',
        outcome: 'full_payment',
        amount_collected: 150,
        location_lat: 28.6139,
        location_lng: 77.2090,
      }),
    );
  });

  it('shows success alert with log ID on successful submit', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    const expoRouter = require('expo-router');
    expoRouter.useLocalSearchParams = jest.fn(() => ({ loanId: '5', borrowerName: 'Ravi K.' })) as any;
    const collections = require('../../src/services/collections');
    collections.createCollectionLog.mockResolvedValueOnce({ success: true, logId: 42 });

    const { findByText, getByPlaceholderText } = render(<Wrapper><AgentCollectionLogScreen /></Wrapper>);
    fireEvent.press(await findByText('Field Visit'));
    fireEvent.press(await findByText('Full Payment'));
    fireEvent.changeText(getByPlaceholderText('28.6139'), '28.6139');
    fireEvent.changeText(getByPlaceholderText('77.2090'), '77.2090');
    fireEvent.changeText(getByPlaceholderText('e.g. 120'), '150');

    const submit = await findByText('Save Collection Log');
    await act(async () => { fireEvent.press(submit); });

    expect(alertSpy).toHaveBeenCalledWith(
      'Collection Logged',
      expect.stringContaining('#42'),
      expect.any(Array),
    );
  });

  it('shows error alert when createCollectionLog fails', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    const expoRouter = require('expo-router');
    expoRouter.useLocalSearchParams = jest.fn(() => ({ loanId: '5', borrowerName: 'Ravi K.' })) as any;
    const collections = require('../../src/services/collections');
    collections.createCollectionLog.mockResolvedValueOnce({ success: false, error: 'DB error' });

    const { findByText, getByPlaceholderText } = render(<Wrapper><AgentCollectionLogScreen /></Wrapper>);
    fireEvent.press(await findByText('Field Visit'));
    fireEvent.press(await findByText('Full Payment'));
    fireEvent.changeText(getByPlaceholderText('e.g. 120'), '150');

    const submit = await findByText('Save Collection Log');
    await act(async () => { fireEvent.press(submit); });

    expect(alertSpy).toHaveBeenCalledWith('Error', expect.stringContaining('DB error'));
  });
});

// ═══════════════════════════════════════════════════════
// RESET TESTS
// ═══════════════════════════════════════════════════════

describe('CollectionLogScreen — reset form', () => {
  it('clears form fields when Reset Form is pressed', async () => {
    const { findByText, queryByPlaceholderText, getByPlaceholderText } = render(<Wrapper><AgentCollectionLogScreen /></Wrapper>);
    fireEvent.press(await findByText('Field Visit'));
    fireEvent.press(await findByText('Full Payment'));
    fireEvent.changeText(getByPlaceholderText('e.g. 120'), '150');
    fireEvent.changeText(getByPlaceholderText(/Add any additional notes/), 'Some notes');

    const reset = await findByText('Reset Form');
    fireEvent.press(reset);

    expect(queryByPlaceholderText('e.g. 120')).toBeNull();
    expect(queryByPlaceholderText(/Add any additional notes/)).toBeTruthy();
  });
});
