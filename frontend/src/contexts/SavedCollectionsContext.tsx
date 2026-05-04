"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { TourCard } from "@/lib/types";

const STORAGE_KEY = "tourvisor_saved_collections";

export interface SavedCollection {
  /** Уникальный id (генерируется в момент сохранения). */
  id: string;
  /** Человекочитаемое имя подборки от агента. */
  name: string;
  /** Снимок tourcard на момент сохранения. */
  cards: TourCard[];
  createdAt: number;
  updatedAt: number;
  /** Сохранённая публичная HTML-ссылка (если агент уже делился). */
  shareUrl?: string | null;
}

interface SavedCollectionsState {
  collections: SavedCollection[];
  saveCollection: (
    name: string,
    cards: TourCard[],
    options?: { shareUrl?: string | null }
  ) => SavedCollection;
  renameCollection: (id: string, name: string) => void;
  removeCollection: (id: string) => void;
  updateCollection: (id: string, patch: Partial<SavedCollection>) => void;
  /** Подменить одну карточку внутри подборки (например, после refresh цены). */
  updateCardInCollection: (
    collectionId: string,
    tourId: string,
    patch: Partial<TourCard>
  ) => void;
  removeCardFromCollection: (collectionId: string, tourId: string) => void;
}

const SavedCollectionsContext = createContext<SavedCollectionsState>({
  collections: [],
  saveCollection: () => ({
    id: "",
    name: "",
    cards: [],
    createdAt: 0,
    updatedAt: 0,
  }),
  renameCollection: () => {},
  removeCollection: () => {},
  updateCollection: () => {},
  updateCardInCollection: () => {},
  removeCardFromCollection: () => {},
});

function loadLocal(): SavedCollection[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedCollection[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (c) => c && typeof c.id === "string" && Array.isArray(c.cards)
    );
  } catch {
    return [];
  }
}

function saveLocal(collections: SavedCollection[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(collections));
  } catch {
    /* quota / privacy mode — silently ignore */
  }
}

function genId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `coll_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function SavedCollectionsProvider({ children }: { children: ReactNode }) {
  /** Lazy init: читаем localStorage в момент первого рендера на клиенте.
   *  На сервере вернётся [] (window не определён) — это нормально, т.к.
   *  избранное и подборки нужны только в клиентских интерактивных view. */
  const [collections, setCollections] = useState<SavedCollection[]>(() => loadLocal());

  const persist = useCallback((updater: (prev: SavedCollection[]) => SavedCollection[]) => {
    setCollections((prev) => {
      const next = updater(prev);
      saveLocal(next);
      return next;
    });
  }, []);

  const saveCollection = useCallback<SavedCollectionsState["saveCollection"]>(
    (name, cards, options) => {
      const trimmed = (name || "").trim() || "Без названия";
      const now = Date.now();
      const collection: SavedCollection = {
        id: genId(),
        name: trimmed,
        cards: cards.map((c) => ({ ...c })),
        createdAt: now,
        updatedAt: now,
        shareUrl: options?.shareUrl ?? null,
      };
      persist((prev) => [collection, ...prev]);
      return collection;
    },
    [persist]
  );

  const renameCollection = useCallback<SavedCollectionsState["renameCollection"]>(
    (id, name) => {
      const trimmed = (name || "").trim();
      if (!trimmed) return;
      persist((prev) =>
        prev.map((c) =>
          c.id === id ? { ...c, name: trimmed, updatedAt: Date.now() } : c
        )
      );
    },
    [persist]
  );

  const removeCollection = useCallback<SavedCollectionsState["removeCollection"]>(
    (id) => persist((prev) => prev.filter((c) => c.id !== id)),
    [persist]
  );

  const updateCollection = useCallback<SavedCollectionsState["updateCollection"]>(
    (id, patch) =>
      persist((prev) =>
        prev.map((c) =>
          c.id === id ? { ...c, ...patch, updatedAt: Date.now() } : c
        )
      ),
    [persist]
  );

  const updateCardInCollection = useCallback<
    SavedCollectionsState["updateCardInCollection"]
  >(
    (collectionId, tourId, patch) =>
      persist((prev) =>
        prev.map((c) =>
          c.id !== collectionId
            ? c
            : {
                ...c,
                updatedAt: Date.now(),
                cards: c.cards.map((card) =>
                  card.tour_id === tourId ? { ...card, ...patch } : card
                ),
              }
        )
      ),
    [persist]
  );

  const removeCardFromCollection = useCallback<
    SavedCollectionsState["removeCardFromCollection"]
  >(
    (collectionId, tourId) =>
      persist((prev) =>
        prev
          .map((c) =>
            c.id !== collectionId
              ? c
              : {
                  ...c,
                  updatedAt: Date.now(),
                  cards: c.cards.filter((card) => card.tour_id !== tourId),
                }
          )
          // Подборка без карточек становится бесполезной — авто-удаляем.
          .filter((c) => c.cards.length > 0)
      ),
    [persist]
  );

  const value = useMemo<SavedCollectionsState>(
    () => ({
      collections,
      saveCollection,
      renameCollection,
      removeCollection,
      updateCollection,
      updateCardInCollection,
      removeCardFromCollection,
    }),
    [
      collections,
      saveCollection,
      renameCollection,
      removeCollection,
      updateCollection,
      updateCardInCollection,
      removeCardFromCollection,
    ]
  );

  return (
    <SavedCollectionsContext.Provider value={value}>
      {children}
    </SavedCollectionsContext.Provider>
  );
}

export function useSavedCollections() {
  return useContext(SavedCollectionsContext);
}
