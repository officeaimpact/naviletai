"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { TourCard } from "@/lib/types";

const STORAGE_KEY = "navylet_favorites";

function loadFavorites(): TourCard[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveFavorites(favorites: TourCard[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
  } catch {}
}

export function useFavorites() {
  const [favorites, setFavorites] = useState<TourCard[]>([]);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    setFavorites(loadFavorites());
  }, []);

  const favoritedIds = useMemo(
    () => new Set(favorites.map((c) => c.tour_id)),
    [favorites]
  );

  const addFavorite = useCallback((card: TourCard) => {
    setFavorites((prev) => {
      if (prev.some((c) => c.tour_id === card.tour_id)) return prev;
      const updated = [{ ...card, _favorited_at: Date.now() } as TourCard, ...prev];
      saveFavorites(updated);
      return updated;
    });
  }, []);

  const removeFavorite = useCallback((tourId: string) => {
    setFavorites((prev) => {
      const updated = prev.filter((c) => c.tour_id !== tourId);
      saveFavorites(updated);
      return updated;
    });
  }, []);

  const toggleFavorite = useCallback((card: TourCard) => {
    setFavorites((prev) => {
      const exists = prev.some((c) => c.tour_id === card.tour_id);
      const updated = exists
        ? prev.filter((c) => c.tour_id !== card.tour_id)
        : [card, ...prev];
      saveFavorites(updated);
      return updated;
    });
  }, []);

  const isFavorited = useCallback(
    (tourId: string) => favoritedIds.has(tourId),
    [favoritedIds]
  );

  return {
    favorites,
    favoritedIds,
    addFavorite,
    removeFavorite,
    toggleFavorite,
    isFavorited,
  };
}
