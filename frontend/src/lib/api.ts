import { ChatResponse, HotelInfo, TourFlights } from "./types";

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

export function fixImageUrl(url: string | null | undefined): string {
  if (!url) return "";
  if (url.startsWith("//")) return `https:${url}`;
  return url;
}

export async function sendMessage(
  message: string,
  conversationId?: string
): Promise<ChatResponse> {
  const res = await fetch(`${API_BASE}/api/v1/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      conversation_id: conversationId,
    }),
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

export async function getStatus(): Promise<{
  status: string;
  sessions: number;
}> {
  const res = await fetch(`${API_BASE}/api/status`);
  return res.json();
}
