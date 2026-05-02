import type { TourCard } from "@/lib/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

export interface HealthResponse {
  status: string;
  date?: string;
  mode?: "live" | "llm_only" | "tv_only" | "demo";
  llm_configured?: boolean;
  tourvisor_configured?: boolean;
  model?: string;
  sessions?: number;
}

/**
 * GET /api/health — статус LLM и TourVisor для StatusChip.
 */
export async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch(`${API_BASE}/api/health`);
  if (!res.ok) {
    throw new Error(`health failed: ${res.status}`);
  }
  return res.json();
}

export interface ActualizeFullResponse {
  tourid: string;
  actual_price?: number | null;
  old_price?: number | null;
  delta?: number | null;
  currency?: string;
  operator_link?: string | null;
  places_status?: string | null;
  hotel_name?: string;
  mode?: string;
  error?: string;
  message?: string;
}

/**
 * POST /api/tour/<id>/actualize — расширенная актуализация (delta, places, ссылка
 * оператора). Используется в новом CTA «Актуализировать цену» в HotelDetailPanel.
 * Legacy GET-вариант остаётся в `lib/api.ts` для FavoritesRefresh.
 */
export async function actualizeTourFull(
  tourId: string
): Promise<ActualizeFullResponse> {
  const res = await fetch(`${API_BASE}/api/tour/${tourId}/actualize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  const body = (await res.json().catch(() => ({}))) as ActualizeFullResponse;
  if (!res.ok) {
    if (res.status === 410 || body?.error === "expired") {
      throw new Error("expired");
    }
    throw new Error(body?.error || `actualize failed: ${res.status}`);
  }
  return body;
}

export interface CreateCollectionResponse {
  collection_id: string;
  share_url: string;
  email_url: string;
  json_url?: string;
  expires_at?: number;
}

/**
 * POST /api/collection — собрать публичную HTML-подборку из карточек выдачи.
 * UI получает share_url, открывает в новой вкладке и кладёт в clipboard.
 */
export async function createCollection(
  cards: TourCard[],
  conversationId?: string
): Promise<CreateCollectionResponse> {
  const res = await fetch(`${API_BASE}/api/collection`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      cards,
      conversation_id: conversationId,
    }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body?.error || `collection failed: ${res.status}`);
  }
  return res.json();
}
