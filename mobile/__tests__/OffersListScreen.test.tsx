/**
 * Unit tests for the Borrower Offers List screen (offers-list.tsx).
 *
 * IMPORTANT: All `jest.mock` factories must NOT reference module-scope variables,
 * because Jest hoists `jest.mock` calls above all imports and declarations.
 * Mock data is defined inline in the factory to ensure useAsyncData resolves
 * correctly on mount.
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
      React.createElement(RN.View, { style: [{ backgroundColor: '#1B3A6B' }, style], ...props }, children),
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

// ── Service mocks with inline data to avoid beforeEach timing issues ──

const mockActiveOffer1 = {
  id: 1, user_id: 1, loan_id: null, amount: 8000, interest_rate: 20,
  tenure_days: 100, tenure_type: 'daily', repayment_schedule: null,
  processing_fee: 400, status: 'pending', source: 'credit_engine',
  expires_at: new Date(Date.now() + 86400000 * 30).toISOString(),
  created_at: '2025-06-01T00:00:00Z', updated_at: '2025-06-01T00:00:00Z',
};

const mockActiveOffer2 = {
  id: 2, user_id: 1, loan_id: null, amount: 12000, interest_rate: 18,
  tenure_days: 150, tenure_type: 'weekly', repayment_schedule: null,
  processing_fee: 600, status: 'pending', source: 'campaign',
  metadata: { campaign: 'summer25' },
  expires_at: new Date(Date.now() + 86400000 * 45).toISOString(),
  created_at: '2025-06-05T00:00:00Z', updated_at: '2025-06-05T00:00:00Z',
};

const mockExpiredOffer = {
  id: 3, user_id: 1, loan_id: null, amount: 5000, interest_rate: 22,
  tenure_days: 75, tenure_type: 'daily', repayment_schedule: null,
  processing_fee: 250, status: 'expired', source: 'referral',
  expires_at: '2025-05-01T00:00:00Z',
  created_at: '2025-04-01T00:00:00Z', updated_at: '2025-04-01T00:00:00Z',
};

const mockDefaultOffers = [mockActiveOffer1, mockActiveOffer2, mockExpiredOffer];

// Store the offers array in a mutable container so tests can override it
const mockState: { offers: any[] } = { offers: mockDefaultOffers };

jest.mock('@mocks/services/offers', () => ({
  fetchOffers: jest.fn(() => Promise.resolve(mockState.offers)),
  acceptOffer: jest.fn(() => Promise.resolve({ success: true, loanId: 101 })),
  rejectOffer: jest.fn(() => Promise.resolve({ success: true })),
}));

import BorrowerOffersListScreen from '../app/(borrower)/offers-list';

// ── Setup ──

beforeEach(() => {
  jest.clearAllMocks();
  mockState.offers = mockDefaultOffers;
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

// ═══════════════════════════════════════════════════════
// RENDERING TESTS
// ═══════════════════════════════════════════════════════

describe('OffersListScreen — rendering', () => {
  it('renders the top nav with title', async () => {
    const { findByText } = render(<Wrapper><BorrowerOffersListScreen /></Wrapper>);
    await findByText('Pre-Approved Offers');
  });

  it('shows the hero banner with active offer count', async () => {
    const { findByText } = render(<Wrapper><BorrowerOffersListScreen /></Wrapper>);
    await findByText(/Pre-Approved/);
  });

  it('renders offer cards with source badges', async () => {
    const { findByText } = render(<Wrapper><BorrowerOffersListScreen /></Wrapper>);
    await findByText('AI Recommended');
    await findByText('Campaign');
  });

  it('renders offer amounts on cards', async () => {
    const { findByText } = render(<Wrapper><BorrowerOffersListScreen /></Wrapper>);
    await findByText('₹8,000');
    await findByText('₹12,000');
  });

  it('shows the history section with expired offers', async () => {
    const { findByText } = render(<Wrapper><BorrowerOffersListScreen /></Wrapper>);
    await findByText('History');
    const expiredBadge = await findByText('Expired');
    expect(expiredBadge).toBeTruthy();
  });

  it('shows the source badge for referral offers in history', async () => {
    const { findByText } = render(<Wrapper><BorrowerOffersListScreen /></Wrapper>);
    await findByText('Referral Bonus');
  });
});


describe('OffersListScreen — expiry warnings', () => {
  it('shows expiry warning when offer expires within 3 days', async () => {
    const nearFuture = new Date(Date.now() + 86400000).toISOString();
    mockState.offers = [{
      ...mockActiveOffer1,
      expires_at: nearFuture,
    }];
    const { findByText } = render(<Wrapper><BorrowerOffersListScreen /></Wrapper>);
    await findByText(/Expires in 1 day/);
  });
});

// ═══════════════════════════════════════════════════════
// INTERACTION TESTS
// ═══════════════════════════════════════════════════════

describe('OffersListScreen — interactions', () => {
  it('calls acceptOffer when Accept button is pressed and confirmed', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');

    const { findAllByText } = render(<Wrapper><BorrowerOffersListScreen /></Wrapper>);
    const acceptButtons = await findAllByText('Accept');
    expect(acceptButtons.length).toBeGreaterThanOrEqual(1);

    fireEvent.press(acceptButtons[0]);
    expect(alertSpy).toHaveBeenCalled();

    const acceptAlertCall = alertSpy.mock.calls.find(([title]) => title === 'Accept Offer');
    expect(acceptAlertCall).toBeTruthy();
    const acceptAction = acceptAlertCall![2]?.find((btn: any) => btn?.text === 'Accept & Proceed');
    expect(acceptAction).toBeTruthy();

    const offers = require('@mocks/services/offers') as jest.Mocked<typeof import('@mocks/services/offers')>;
    await act(async () => { await acceptAction!.onPress!(); });
    expect(offers.acceptOffer).toHaveBeenCalled();
  });

  it('calls rejectOffer when Skip button is pressed and confirmed', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');

    const { findAllByText } = render(<Wrapper><BorrowerOffersListScreen /></Wrapper>);
    const skipButtons = await findAllByText('Skip');
    expect(skipButtons.length).toBeGreaterThanOrEqual(1);

    fireEvent.press(skipButtons[0]);
    expect(alertSpy).toHaveBeenCalled();

    const skipAlertCall = alertSpy.mock.calls.find(([title]) => title === 'Skip Offer');
    expect(skipAlertCall).toBeTruthy();
    const skipAction = skipAlertCall![2]?.find((btn: any) => btn?.text === 'Skip');
    expect(skipAction).toBeTruthy();

    const offers = require('@mocks/services/offers') as jest.Mocked<typeof import('@mocks/services/offers')>;
    await act(async () => { await skipAction!.onPress!(); });
    expect(offers.rejectOffer).toHaveBeenCalled();
  });
});

describe('OffersListScreen — accept error handling', () => {
  it('shows error alert when acceptOffer fails', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    const offers = require('@mocks/services/offers') as jest.Mocked<typeof import('@mocks/services/offers')>;
    offers.acceptOffer.mockResolvedValueOnce({ success: false, error: 'Server error' });

    const { findAllByText } = render(<Wrapper><BorrowerOffersListScreen /></Wrapper>);
    const acceptButtons = await findAllByText('Accept');
    fireEvent.press(acceptButtons[0]);

    const acceptAlertCall = alertSpy.mock.calls.find(([title]) => title === 'Accept Offer');
    const acceptAction = acceptAlertCall![2]?.find((btn: any) => btn?.text === 'Accept & Proceed');

    await act(async () => { await acceptAction!.onPress!(); });

    const errorAlertCall = alertSpy.mock.calls.find(([title]) => title === 'Error');
    expect(errorAlertCall).toBeTruthy();
    expect(errorAlertCall![1]).toContain('Server error');
  });
});
