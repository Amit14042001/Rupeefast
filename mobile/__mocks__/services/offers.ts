/**
 * Mock offers service for tests.
 */

export const fetchOffers = jest.fn().mockResolvedValue([
  {
    id: 1, user_id: 1, amount: 8000, interest_rate: 20, tenure_days: 100,
    processing_fee: 400, status: 'pending', expires_at: '2025-07-15T00:00:00Z',
    source: 'credit_engine', created_at: '2025-06-01T00:00:00Z', updated_at: '2025-06-01T00:00:00Z',
  },
  {
    id: 2, user_id: 1, amount: 12000, interest_rate: 18, tenure_days: 150,
    processing_fee: 600, status: 'pending', expires_at: '2025-08-01T00:00:00Z',
    source: 'campaign', metadata: { campaign: 'summer25' }, created_at: '2025-06-05T00:00:00Z', updated_at: '2025-06-05T00:00:00Z',
  },
  {
    id: 3, user_id: 1, amount: 5000, interest_rate: 22, tenure_days: 75,
    processing_fee: 250, status: 'expired', expires_at: '2025-05-01T00:00:00Z',
    source: 'referral', created_at: '2025-04-01T00:00:00Z', updated_at: '2025-04-01T00:00:00Z',
  },
]);

export const acceptOffer = jest.fn().mockResolvedValue({ success: true, loanId: 101 });

export const rejectOffer = jest.fn().mockResolvedValue({ success: true });
