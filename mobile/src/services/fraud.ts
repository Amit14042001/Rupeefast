/**
 * RupeeFast — Fraud Events Service
 *
 * Manages fraud detection events from the `fraud_events` table (migration 008).
 * Admin use to monitor, investigate, and resolve fraud alerts.
 */

import { apiFetch } from '../api/client';
import { ENDPOINTS } from '../api/endpoints';
import type {
  FraudEvent,
  FraudEventsResponse,
  FraudSeverity,
  FraudStatus,
  FraudEventType,
} from '../types';

/**
 * Fetch fraud events with optional filters.
 */
export async function fetchFraudEvents(
  params?: {
    severity?: FraudSeverity;
    status?: FraudStatus;
    event_type?: FraudEventType;
  },
): Promise<FraudEvent[]> {
  const query = new URLSearchParams();
  if (params?.severity) query.set('severity', params.severity);
  if (params?.status) query.set('status', params.status);
  if (params?.event_type) query.set('type', params.event_type);
  const qs = query.toString();

  const result = await apiFetch<FraudEventsResponse>(
    `${ENDPOINTS.FRAUD_EVENTS}${qs ? `?${qs}` : ''}`,
  );

  if (!result.success) return [];
  return result.data?.events ?? [];
}

/**
 * Update a fraud event's status (e.g., investigate, resolve, dismiss).
 */
export async function updateFraudEventStatus(
  eventId: number,
  status: FraudStatus,
  resolution?: string,
): Promise<{ success: boolean; error?: string }> {
  const result = await apiFetch(ENDPOINTS.FRAUD_EVENT_UPDATE(eventId), {
    method: 'POST',
    body: { status, resolution },
  });

  if (!result.success) {
    return { success: false, error: result.error };
  }

  return { success: true };
}
