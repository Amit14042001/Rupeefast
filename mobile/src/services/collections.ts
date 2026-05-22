/**
 * RupeeFast — Collections Service
 *
 * Manages field collection logs from the `collection_logs` table (migration 008).
 * Agents use this to log collection attempts with GPS, outcomes, and promises.
 */

import { apiFetch } from '../api/client';
import { ENDPOINTS } from '../api/endpoints';
import type {
  CollectionLog,
  CollectionLogsResponse,
  CollectionType,
  CollectionStatus,
  CollectionOutcome,
  ContactRelationship,
  ContactMethod,
} from '../types';

/** Payload for creating a new collection log entry */
export interface CreateCollectionLogPayload {
  loan_id: number;
  collection_type: CollectionType;
  contacted_person?: string;
  relationship?: ContactRelationship;
  contact_method?: ContactMethod;
  amount_promised?: number;
  promise_date?: string;
  amount_collected?: number;
  notes?: string;
  outcome?: CollectionOutcome;
  location_lat?: number;
  location_lng?: number;
  duration_minutes?: number;
  attachments?: string[];
}

/**
 * Fetch collection logs. Apply filters via query params.
 */
export async function fetchCollectionLogs(
  params?: { loan_id?: number; status?: CollectionStatus; agent_id?: number },
): Promise<CollectionLog[]> {
  const query = new URLSearchParams();
  if (params?.loan_id) query.set('loan_id', String(params.loan_id));
  if (params?.status) query.set('status', params.status);
  if (params?.agent_id) query.set('agent_id', String(params.agent_id));
  const qs = query.toString();

  const result = await apiFetch<CollectionLogsResponse>(
    `${ENDPOINTS.COLLECTION_LOGS}${qs ? `?${qs}` : ''}`,
  );

  if (!result.success) return [];
  return result.data?.logs ?? [];
}

/**
 * Create a new collection log entry.
 */
export async function createCollectionLog(
  payload: CreateCollectionLogPayload,
): Promise<{ success: boolean; logId?: number; error?: string }> {
  const result = await apiFetch(ENDPOINTS.COLLECTION_LOG_CREATE, {
    method: 'POST',
    body: payload,
  });

  if (!result.success) {
    return { success: false, error: result.error };
  }

  return { success: true, logId: (result as any).data?.log?.id };
}

/**
 * Update an existing collection log entry.
 */
export async function updateCollectionLog(
  id: number,
  payload: Partial<CreateCollectionLogPayload>,
): Promise<{ success: boolean; error?: string }> {
  const result = await apiFetch(ENDPOINTS.COLLECTION_LOG_UPDATE(id), {
    method: 'PUT',
    body: payload,
  });

  if (!result.success) {
    return { success: false, error: result.error };
  }

  return { success: true };
}
