"use client";

import { useEffect, useRef, useState } from "react";
import { TourCard, HotelInfo } from "@/lib/types";
import { getHotelInfo, fixImageUrl } from "@/lib/api";
import { formatPrice } from "@/lib/format";
import { Star, MapPin, X, Maximize2, Minimize2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface HotelMapProps {
  cards?: TourCard[];
  singleHotel?: { lat: number; lng: number; name: string; stars: number };
  onSelectCard?: (card: TourCard) => void;
  className?: string;
  compact?: boolean;
}

interface ResolvedMarker {
  lat: number;
  lng: number;
  card: TourCard;
  image?: string;
}

export function HotelMap({ cards, singleHotel, onSelectCard, className, compact = false }: HotelMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const [resolvedMarkers, setResolvedMarkers] = useState<ResolvedMarker[]>([]);
  const [ready, setReady] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [L, setL] = useState<typeof import("leaflet") | null>(null);

  useEffect(() => {
    import("leaflet").then((mod) => {
      setL(mod.default || mod);
      setReady(true);
    });
  }, []);

  useEffect(() => {
    if (!cards || cards.length === 0) return;

    let cancelled = false;
    const resolve = async () => {
      const results: ResolvedMarker[] = [];
      for (const card of cards) {
        if (card.hotel_code == null) continue;
        try {
          const info = await getHotelInfo(card.hotel_code);
          const lat = parseFloat(info.coordinates?.lat);
          const lng = parseFloat(info.coordinates?.lon);
          if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
            results.push({
              lat, lng, card,
              image: info.images?.[0] ? fixImageUrl(info.images[0]) : fixImageUrl(card.image_url) || undefined,
            });
          }
        } catch { /* skip hotels without info */ }
      }
      if (!cancelled) setResolvedMarkers(results);
    };
    resolve();
    return () => { cancelled = true; };
  }, [cards]);

  useEffect(() => {
    if (!ready || !L || !mapRef.current) return;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }
    markersRef.current = [];

    const defaultIcon = L.icon({
      iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
      iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
      shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
    });

    if (singleHotel) {
      const map = L.map(mapRef.current, { zoomControl: !compact, attributionControl: !compact })
        .setView([singleHotel.lat, singleHotel.lng], 15);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: compact ? "" : '&copy; <a href="https://openstreetmap.org">OSM</a>',
      }).addTo(map);
      const marker = L.marker([singleHotel.lat, singleHotel.lng], { icon: defaultIcon }).addTo(map);
      marker.bindPopup(`<b>${singleHotel.name}</b><br/>${"★".repeat(singleHotel.stars)}`);
      mapInstanceRef.current = map;
      return;
    }

    if (resolvedMarkers.length === 0) return;

    const center: L.LatLngExpression = [
      resolvedMarkers.reduce((s, m) => s + m.lat, 0) / resolvedMarkers.length,
      resolvedMarkers.reduce((s, m) => s + m.lng, 0) / resolvedMarkers.length,
    ];

    const map = L.map(mapRef.current, { zoomControl: true, attributionControl: true }).setView(center, 12);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://openstreetmap.org">OSM</a>',
    }).addTo(map);

    const bounds = L.latLngBounds([]);

    for (const m of resolvedMarkers) {
      const priceIcon = L.divIcon({
        className: "hotel-price-marker",
        html: `<div style="
          background: #009af3; color: white; padding: 4px 8px; border-radius: 8px;
          font-size: 12px; font-weight: 700; white-space: nowrap;
          box-shadow: 0 2px 8px rgba(0,0,0,0.25); border: 2px solid white;
          display: flex; align-items: center; gap: 3px; cursor: pointer;
        ">${formatPrice(m.card.price)}</div>`,
        iconSize: [0, 0],
        iconAnchor: [40, 20],
      });

      const marker = L.marker([m.lat, m.lng], { icon: priceIcon }).addTo(map);
      bounds.extend([m.lat, m.lng]);

      const imgTag = m.image
        ? `<img src="${m.image}" style="width:100%;height:80px;object-fit:cover;border-radius:6px 6px 0 0;"/>`
        : "";

      marker.bindPopup(`
        <div style="width:200px;font-family:system-ui;margin:-1px;">
          ${imgTag}
          <div style="padding:8px 10px;">
            <div style="font-weight:700;font-size:13px;margin-bottom:2px;">${m.card.hotel_name}</div>
            <div style="font-size:11px;color:#666;">
              ${"★".repeat(m.card.hotel_stars)} · ${m.card.hotel_rating}
            </div>
            <div style="font-size:14px;font-weight:700;color:#009af3;margin-top:4px;">
              от ${formatPrice(m.card.price)}
            </div>
            <div style="font-size:10px;color:#999;margin-top:2px;">
              ${m.card.nights} ночей · ${m.card.meal_description || ""}
            </div>
          </div>
        </div>
      `, { maxWidth: 220, minWidth: 200, className: "hotel-popup" });

      marker.on("click", () => {
        marker.openPopup();
      });

      marker.on("popupopen", () => {
        const popupEl = marker.getPopup()?.getElement();
        if (popupEl && onSelectCard) {
          popupEl.style.cursor = "pointer";
          popupEl.onclick = (e: MouseEvent) => {
            if ((e.target as HTMLElement).closest(".leaflet-popup-close-button")) return;
            onSelectCard(m.card);
          };
        }
      });

      markersRef.current.push(marker);
    }

    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    }

    mapInstanceRef.current = map;
  }, [ready, L, singleHotel, resolvedMarkers, compact, onSelectCard]);

  useEffect(() => {
    if (mapInstanceRef.current) {
      setTimeout(() => mapInstanceRef.current?.invalidateSize(), 300);
    }
  }, [expanded]);

  if (!singleHotel && (!cards || cards.length === 0)) return null;
  if (!singleHotel && resolvedMarkers.length === 0 && cards && cards.length > 0) {
    return (
      <div className={cn("bg-muted/30 rounded-xl flex items-center justify-center", className)}>
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <MapPin className="h-4 w-4 animate-pulse" />
          <span>Загрузка карты...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("relative rounded-xl overflow-hidden border border-border/50", expanded ? "fixed inset-4 z-50" : "", className)}>
      {expanded && (
        <div className="fixed inset-0 bg-black/40 -z-10" onClick={() => setExpanded(false)} />
      )}
      <div ref={mapRef} className="w-full h-full" />
      {!compact && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="absolute top-3 right-3 z-[1000] p-2 bg-white rounded-lg shadow-md hover:bg-gray-50 transition-colors"
          title={expanded ? "Свернуть" : "Развернуть"}
        >
          {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </button>
      )}
      {expanded && (
        <button
          onClick={() => setExpanded(false)}
          className="absolute top-3 left-3 z-[1000] p-2 bg-white rounded-lg shadow-md hover:bg-gray-50 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
