import { env } from '../config/env.js';

/**
 * Triggers background vector reindexing for a user in the recommendation microservice.
 * Non-blocking: failures will log warnings and never fail primary transactions.
 */
export async function triggerUserReindex(userId: string): Promise<void> {
  if (!env.REC_SERVICE_URL) return;
  try {
    const url = `${env.REC_SERVICE_URL}/internal/reindex/user/${encodeURIComponent(userId)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'x-gateway-secret': env.GATEWAY_SECRET,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(4000),
    });

    if (!res.ok) {
      console.warn(`[RecommendationClient] User reindex returned status ${res.status} for user ${userId}`);
    }
  } catch (err: any) {
    console.warn(`[RecommendationClient] Failed to trigger user reindex for user ${userId}:`, err?.message || err);
  }
}

/**
 * Triggers background vector reindexing for a board posting in the recommendation microservice.
 * Non-blocking: failures will log warnings and never fail primary transactions.
 */
export async function triggerBoardReindex(postingId: string): Promise<void> {
  if (!env.REC_SERVICE_URL) return;
  try {
    const url = `${env.REC_SERVICE_URL}/internal/reindex/board/${encodeURIComponent(postingId)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'x-gateway-secret': env.GATEWAY_SECRET,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(4000),
    });

    if (!res.ok) {
      console.warn(`[RecommendationClient] Board reindex returned status ${res.status} for board ${postingId}`);
    }
  } catch (err: any) {
    console.warn(`[RecommendationClient] Failed to trigger board reindex for board ${postingId}:`, err?.message || err);
  }
}
