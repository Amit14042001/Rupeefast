/**
 * Mock collections service for tests.
 */

export const createCollectionLog = jest.fn().mockResolvedValue({ success: true, logId: 42 });

export const updateCollectionLog = jest.fn().mockResolvedValue({ success: true });

export const fetchCollectionLogs = jest.fn().mockResolvedValue([
  {
    id: 1, loan_id: 1, agent_id: 1, collection_type: 'field_visit',
    outcome: 'full_payment', amount_collected: 120, status: 'completed',
    contacted_person: 'Ravi K.', created_at: '2025-06-15T10:30:00Z',
  },
]);
