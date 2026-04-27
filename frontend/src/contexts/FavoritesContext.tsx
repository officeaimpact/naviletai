"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
  type ReactNode,
} from "react";
import { TourCard } from "@/lib/types";
import { useAuth } from "@/hooks/useAuth";

const STORAGE_KEY = "navylet_favorites";

function loadLocal(): TourCard[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocal(favs: TourCard[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(favs));
  } catch {}
}

interface FavoritesState {
  favorites: TourCard[];
  favoritedIds: Set<string>;
  addFavorite: (card: TourCard) => void;
  removeFavorite: (tourId: string) => void;
  toggleFavorite: (card: TourCard) => void;
  isFavorited: (tourId: string) => boolean;
  updateFavorite: (tourId: string, patch: Partial<TourCard>) => void;
  updateFavoritePrice: (tourId: string, newPrice: number) => void;
}

const FavoritesContext = createContext<FavoritesState>({
  favorites: [],
  favoritedIds: new Set(),
  addFavorite: () => {},
  removeFavorite: () => {},
  toggleFavorite: () => {},
  isFavorited: () => false,
  updateFavorite: () => {},
  updateFavoritePrice: () => {},
});

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const { user, supabase, loading: authLoading } = useAuth();
  const [favorites, setFavorites] = useState<TourCard[]>([]);
  const prevAuthKey = useRef<string | null>(null);
  const migratedForUser = useRef<string | null>(null);

  const isAuth = !!user && !!supabase;
  const authKey = isAuth ? user!.id : "anon";

  useEffect(() => {
    if (authLoading) return;
    if (prevAuthKey.current === authKey) return;
    prevAuthKey.current = authKey;

    if (isAuth) {
      supabase
        .from("favorites")
        .select("tour_id, card_data, created_at")
        .order("created_at", { ascending: false })
        .then(
          ({
            data,
          }: {
            data: {
              tour_id: string;
              card_data: TourCard;
              created_at: string;
            }[] | null;
          }) => {
            if (data) {
              setFavorites(
                data.map((row) => ({ ...row.card_data, tour_id: row.tour_id }))
              );
            }
          }
        );
    } else {
      queueMicrotask(() => setFavorites([]));
      if (typeof window !== "undefined") localStorage.removeItem(STORAGE_KEY);
    }
  }, [authKey, isAuth, supabase, authLoading]);

  useEffect(() => {
    if (!isAuth || !user) return;
    if (migratedForUser.current === user.id) return;
    migratedForUser.current = user.id;

    const local = loadLocal();
    if (local.length === 0) return;

    (async () => {
      const rows = local.map((card) => ({
        user_id: user.id,
        tour_id: card.tour_id,
        card_data: card,
      }));
      await supabase
        .from("favorites")
        .upsert(rows, { onConflict: "user_id,tour_id" });
      localStorage.removeItem(STORAGE_KEY);

      const { data } = await supabase
        .from("favorites")
        .select("tour_id, card_data, created_at")
        .order("created_at", { ascending: false });
      if (data) {
        setFavorites(
          data.map(
            (row: { tour_id: string; card_data: TourCard }) => ({
              ...row.card_data,
              tour_id: row.tour_id,
            })
          )
        );
      }
    })();
  }, [isAuth, supabase, user]);

  const favoritedIds = useMemo(
    () => new Set(favorites.map((c) => c.tour_id)),
    [favorites]
  );

  const addFavorite = useCallback(
    (card: TourCard) => {
      setFavorites((prev) => {
        if (prev.some((c) => c.tour_id === card.tour_id)) return prev;
        return [card, ...prev];
      });
      if (isAuth) {
        supabase.from("favorites").upsert(
          { user_id: user!.id, tour_id: card.tour_id, card_data: card },
          { onConflict: "user_id,tour_id" }
        );
      } else {
        setFavorites((prev) => {
          saveLocal(prev);
          return prev;
        });
      }
    },
    [isAuth, supabase, user]
  );

  const removeFavorite = useCallback(
    (tourId: string) => {
      setFavorites((prev) => {
        const updated = prev.filter((c) => c.tour_id !== tourId);
        if (!isAuth) saveLocal(updated);
        return updated;
      });
      if (isAuth) {
        supabase
          .from("favorites")
          .delete()
          .eq("tour_id", tourId)
          .eq("user_id", user!.id);
      }
    },
    [isAuth, supabase, user]
  );

  const toggleFavorite = useCallback(
    (card: TourCard) => {
      const exists = favorites.some((c) => c.tour_id === card.tour_id);
      if (exists) {
        removeFavorite(card.tour_id);
      } else {
        addFavorite(card);
      }
    },
    [favorites, addFavorite, removeFavorite]
  );

  const isFavorited = useCallback(
    (tourId: string) => favoritedIds.has(tourId),
    [favoritedIds]
  );

  const updateFavorite = useCallback(
    (tourId: string, patch: Partial<TourCard>) => {
      setFavorites((prev) => {
        const updated = prev.map((c) =>
          c.tour_id === tourId ? { ...c, ...patch } : c
        );
        if (!isAuth) saveLocal(updated);
        return updated;
      });
      if (isAuth) {
        supabase
          .from("favorites")
          .select("card_data")
          .eq("tour_id", tourId)
          .eq("user_id", user!.id)
          .single()
          .then(({ data }: { data: { card_data: TourCard } | null }) => {
            if (data) {
              supabase
                .from("favorites")
                .update({ card_data: { ...data.card_data, ...patch } })
                .eq("tour_id", tourId)
                .eq("user_id", user!.id);
            }
          });
      }
    },
    [isAuth, supabase, user]
  );

  const updateFavoritePrice = useCallback(
    (tourId: string, newPrice: number) => {
      updateFavorite(tourId, { price: newPrice });
    },
    [updateFavorite]
  );

  return (
    <FavoritesContext.Provider
      value={{
        favorites,
        favoritedIds,
        addFavorite,
        removeFavorite,
        toggleFavorite,
        isFavorited,
        updateFavorite,
        updateFavoritePrice,
      }}
    >
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  return useContext(FavoritesContext);
}
