"use client";

import { useCallback, useMemo, useState } from "react";
import { actualizeTour } from "@/lib/api";
import { FavoriteRefreshStatus, TourCard } from "@/lib/types";
import { useFavorites } from "@/hooks/useFavorites";

type BulkRefreshState = "idle" | "running" | "completed" | "partialError";

interface BulkRefreshSummary {
  total: number;
  processed: number;
  ok: number;
  expired: number;
  unavailable: number;
  error: number;
}

const INITIAL_SUMMARY: BulkRefreshSummary = {
  total: 0,
  processed: 0,
  ok: 0,
  expired: 0,
  unavailable: 0,
  error: 0,
};

const CONCURRENCY_LIMIT = 2;

function createStatusPatch(status: FavoriteRefreshStatus, message?: string) {
  return {
    _refreshStatus: status,
    _refreshMessage:
      message ||
      (status === "ok"
        ? "Цена обновлена"
        : status === "expired"
          ? "Тур устарел"
          : status === "unavailable"
            ? "Нет в наличии"
            : "Не удалось обновить"),
  };
}

export function useFavoritesRefresh() {
  const { favorites, updateFavorite } = useFavorites();
  const [refreshingIds, setRefreshingIds] = useState<Set<string>>(new Set());
  const [refreshResults, setRefreshResults] = useState<
    Record<string, FavoriteRefreshStatus>
  >({});
  const [bulkState, setBulkState] = useState<BulkRefreshState>("idle");
  const [bulkSummary, setBulkSummary] =
    useState<BulkRefreshSummary>(INITIAL_SUMMARY);

  const markRefreshing = useCallback((tourId: string, isRefreshing: boolean) => {
    setRefreshingIds((prev) => {
      const next = new Set(prev);
      if (isRefreshing) {
        next.add(tourId);
      } else {
        next.delete(tourId);
      }
      return next;
    });
  }, []);

  const refreshOne = useCallback(
    async (card: TourCard): Promise<FavoriteRefreshStatus> => {
      if (!card.tour_id) return "error";
      markRefreshing(card.tour_id, true);
      setRefreshResults((prev) => {
        const next = { ...prev };
        delete next[card.tour_id];
        return next;
      });

      try {
        const result = await actualizeTour(card.tour_id);
        const status = result.status;

        if (status === "ok" && typeof result.price === "number") {
          updateFavorite(card.tour_id, {
            price: result.price,
            operator: result.operator ?? card.operator,
            ...createStatusPatch(status, result.message),
          });
        } else {
          updateFavorite(card.tour_id, createStatusPatch(status, result.message));
        }

        setRefreshResults((prev) => ({ ...prev, [card.tour_id]: status }));
        return status;
      } catch {
        updateFavorite(card.tour_id, createStatusPatch("error"));
        setRefreshResults((prev) => ({ ...prev, [card.tour_id]: "error" }));
        return "error";
      } finally {
        markRefreshing(card.tour_id, false);
      }
    },
    [markRefreshing, updateFavorite]
  );

  const refreshAll = useCallback(async () => {
    if (favorites.length === 0 || refreshingIds.size > 0) return;
    const snapshot = [...favorites];

    setBulkState("running");
    setBulkSummary({
      total: snapshot.length,
      processed: 0,
      ok: 0,
      expired: 0,
      unavailable: 0,
      error: 0,
    });

    let index = 0;
    let ok = 0;
    let expired = 0;
    let unavailable = 0;
    let error = 0;

    const worker = async () => {
      while (index < snapshot.length) {
        const current = snapshot[index];
        index += 1;
        const status = await refreshOne(current);

        if (status === "ok") ok += 1;
        if (status === "expired") expired += 1;
        if (status === "unavailable") unavailable += 1;
        if (status === "error") error += 1;

        setBulkSummary({
          total: snapshot.length,
          processed: ok + expired + unavailable + error,
          ok,
          expired,
          unavailable,
          error,
        });
      }
    };

    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY_LIMIT, snapshot.length) }, () =>
        worker()
      )
    );

    setBulkState(error > 0 || expired > 0 || unavailable > 0 ? "partialError" : "completed");
  }, [favorites, refreshOne, refreshingIds.size]);

  const isBulkRefreshing = bulkState === "running";

  return useMemo(
    () => ({
      refreshingIds,
      refreshResults,
      refreshOne,
      refreshAll,
      isBulkRefreshing,
      bulkState,
      bulkSummary,
    }),
    [
      refreshingIds,
      refreshResults,
      refreshOne,
      refreshAll,
      isBulkRefreshing,
      bulkState,
      bulkSummary,
    ]
  );
}
