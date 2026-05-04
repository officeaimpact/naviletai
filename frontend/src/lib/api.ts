import {
  ChatResponse,
  FavoriteRefreshStatus,
  HotelInfo,
  TourFlights,
} from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

const _hotelCache = new Map<number, HotelInfo>();

export async function getHotelInfo(hotelCode: number): Promise<HotelInfo> {
  const cached = _hotelCache.get(hotelCode);
  if (cached) return cached;

  const res = await fetch(`${API_BASE}/api/hotel/${hotelCode}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch hotel info: ${res.status}`);
  }
  const data: HotelInfo = await res.json();
  _hotelCache.set(hotelCode, data);
  return data;
}

const _flightCache = new Map<string, TourFlights>();

export async function getTourFlights(tourId: string): Promise<TourFlights> {
  const cached = _flightCache.get(tourId);
  if (cached) return cached;

  const res = await fetch(`${API_BASE}/api/tour/${tourId}/flights`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const errType = body?.error === "expired" ? "expired" : "error";
    throw new Error(errType);
  }
  const data: TourFlights = await res.json();
  if (data.flights && data.flights.length > 0) {
    _flightCache.set(tourId, data);
  }
  return data;
}

export async function actualizeTour(
  tourId: string
): Promise<{
  price?: number;
  operator?: string;
  available: boolean;
  error?: string;
  status: FavoriteRefreshStatus;
  message?: string;
}> {
  const res = await fetch(`${API_BASE}/api/tour/${tourId}/actualize`);
  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    if (res.status === 410 || body?.error === "expired") {
      return {
        available: false,
        error: "expired",
        status: "expired",
        message: "Тур устарел",
      };
    }

    return {
      available: false,
      error: body?.error || `Server error: ${res.status}`,
      status: "error",
      message: "Не удалось обновить",
    };
  }

  if (body?.available && typeof body?.price === "number") {
    return {
      price: body.price,
      operator: body.operator,
      available: true,
      status: "ok",
      message: "Цена обновлена",
    };
  }

  if (body?.error === "expired") {
    return {
      available: false,
      error: "expired",
      status: "expired",
      message: "Тур устарел",
    };
  }

  if (body?.available === false) {
    return {
      available: false,
      error: body?.error,
      status: "unavailable",
      message: "Нет в наличии",
    };
  }

  return {
    available: false,
    error: body?.error || "unknown",
    status: "error",
    message: "Не удалось обновить",
  };
}

export function fixImageUrl(url: string | null | undefined): string {
  if (!url) return "";
  if (url.startsWith("//")) return `https:${url}`;
  return url;
}

export async function sendMessage(
  message: string,
  conversationId?: string,
  images?: string[]
): Promise<ChatResponse> {
  const body: Record<string, unknown> = {
    message,
    conversation_id: conversationId,
  };
  if (images && images.length > 0) {
    body.images = images.slice(0, 4);
  }
  const res = await fetch(`${API_BASE}/api/v1/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || `Server error: ${res.status}`);
  }

  return res.json();
}

export async function resetSession(sessionId: string): Promise<void> {
  await fetch(`${API_BASE}/api/reset`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId }),
  });
}

export async function clearClientProfile(
  conversationId: string
): Promise<{ ok: boolean; client_profile: string | null }> {
  const res = await fetch(`${API_BASE}/api/copilot/profile/clear`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ conversation_id: conversationId }),
  });
  if (!res.ok) {
    throw new Error(`Failed to clear profile: ${res.status}`);
  }
  return res.json();
}

export async function setClientProfile(
  conversationId: string,
  profile: string
): Promise<{ ok: boolean; client_profile: string | null }> {
  const res = await fetch(`${API_BASE}/api/copilot/profile/set`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ conversation_id: conversationId, profile }),
  });
  if (!res.ok) {
    throw new Error(`Failed to set profile: ${res.status}`);
  }
  return res.json();
}

export async function getStatus(): Promise<{
  status: string;
  sessions: number;
}> {
  const res = await fetch(`${API_BASE}/api/status`);
  return res.json();
}
