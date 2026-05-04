"use client";

import { ReactNode, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Heart, Trash2, RefreshCw, Bookmark } from "lucide-react";
import { FavoriteRefreshStatus, TourCard } from "@/lib/types";
import { TourCardComponent } from "@/components/cards/TourCard";
import { useFavorites } from "@/hooks/useFavorites";
import { useFavoritesRefresh } from "@/hooks/useFavoritesRefresh";
import { useSavedCollections } from "@/contexts/SavedCollectionsContext";
import { CollectionsView } from "@/components/favorites/CollectionsView";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface FavoritesViewProps {
  onCardDetails?: (card: TourCard) => void;
  onCardFavorite?: (card: TourCard) => void;
  favoritedIds?: Set<string>;
  emptyAction?: ReactNode;
}

type FavoritesTab = "tours" | "collections";

export function FavoritesView({
  onCardDetails,
  onCardFavorite,
  favoritedIds,
  emptyAction,
}: FavoritesViewProps) {
  const { favorites } = useFavorites();
  const { collections } = useSavedCollections();
  const [searchQuery, setSearchQuery] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  const [tab, setTab] = useState<FavoritesTab>("tours");
  const {
    refreshingIds,
    refreshResults,
    refreshOne,
    refreshAll,
    isBulkRefreshing,
    bulkState,
    bulkSummary,
  } = useFavoritesRefresh();

  const handleRefreshPrice = async (card: TourCard) => {
    await refreshOne(card);
  };

  const getRefreshLabel = (
    status?: FavoriteRefreshStatus | null,
    message?: string | null
  ) => {
    if (message) return message;
    if (status === "ok") return "Цена обновлена";
    if (status === "expired") return "Тур устарел";
    if (status === "unavailable") return "Нет в наличии";
    if (status === "error") return "Не удалось обновить";
    return null;
  };

  const getRefreshTone = (status?: FavoriteRefreshStatus | null) => {
    if (status === "ok") return "text-green-600";
    if (status === "expired") return "text-amber-600";
    if (status === "unavailable") return "text-red-500";
    if (status === "error") return "text-red-500";
    return "text-muted-foreground";
  };

  const filtered = searchQuery.trim()
    ? favorites.filter(
        (c) =>
          c.hotel_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.country.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.resort.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : favorites;

  return (
    <div className="flex-1 overflow-y-auto px-4">
      <div className="max-w-3xl mx-auto py-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold">Избранное</h1>
            {tab === "tours" && favorites.length > 0 && (
              <span className="text-sm text-muted-foreground">
                {favorites.length} {favorites.length === 1 ? "тур" : favorites.length < 5 ? "тура" : "туров"}
              </span>
            )}
            {tab === "collections" && collections.length > 0 && (
              <span className="text-sm text-muted-foreground">
                {collections.length} {collections.length === 1 ? "подборка" : collections.length < 5 ? "подборки" : "подборок"}
              </span>
            )}
          </div>
          {tab === "tours" && favorites.length > 0 && (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void refreshAll()}
                disabled={isBulkRefreshing}
                className="text-muted-foreground hover:text-brand gap-1.5"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isBulkRefreshing ? "animate-spin" : ""}`} />
                Обновить цены
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmClear(true)}
                disabled={isBulkRefreshing}
                className="text-muted-foreground hover:text-destructive gap-1.5"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Очистить
              </Button>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 border-b border-border">
          <button
            onClick={() => setTab("tours")}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
              tab === "tours"
                ? "border-brand text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Heart className={cn("h-3.5 w-3.5", tab === "tours" && "fill-red-500 text-red-500")} />
            Туры
            <span className="text-[11px] text-muted-foreground/80">
              {favorites.length}
            </span>
          </button>
          <button
            onClick={() => setTab("collections")}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
              tab === "collections"
                ? "border-brand text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Bookmark className={cn("h-3.5 w-3.5", tab === "collections" && "text-brand")} />
            Подборки
            <span className="text-[11px] text-muted-foreground/80">
              {collections.length}
            </span>
          </button>
        </div>

        {tab === "collections" && (
          <CollectionsView
            onCardDetails={onCardDetails}
            onCardFavorite={onCardFavorite}
            favoritedIds={favoritedIds}
          />
        )}

        {tab === "tours" && favorites.length > 0 && bulkState !== "idle" && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/30 px-3 py-2">
            <p className="text-xs text-muted-foreground">
              {isBulkRefreshing
                ? `Обновлено ${bulkSummary.processed} из ${bulkSummary.total}`
                : bulkState === "completed"
                  ? `Обновлены все ${bulkSummary.total} туров`
                  : `Обновление завершено: ${bulkSummary.ok} успешно, ${bulkSummary.expired + bulkSummary.unavailable + bulkSummary.error} требуют внимания`}
            </p>
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              <span>{bulkSummary.ok} ок</span>
              {(bulkSummary.expired > 0 || bulkSummary.unavailable > 0) && (
                <span className="text-amber-600">
                  {bulkSummary.expired + bulkSummary.unavailable} недоступно
                </span>
              )}
              {bulkSummary.error > 0 && (
                <span className="text-red-500">{bulkSummary.error} ошибок</span>
              )}
            </div>
          </div>
        )}

        {/* Confirm clear */}
        {tab === "tours" && (
        <AnimatePresence>
          {confirmClear && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="p-4 rounded-xl border border-destructive/30 bg-destructive/5 flex items-center justify-between">
                <p className="text-sm">Удалить все из избранного?</p>
                <div className="flex gap-2">
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={isBulkRefreshing}
                    onClick={() => {
                      favorites.forEach((c) => onCardFavorite?.(c));
                      setConfirmClear(false);
                    }}
                  >
                    Удалить
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setConfirmClear(false)}>
                    Отмена
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        )}

        {/* Search */}
        {tab === "tours" && favorites.length > 2 && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Поиск по избранному..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        )}

        {/* Content */}
        {tab === "tours" && (favorites.length === 0 ? (
          <div className="text-center py-20 space-y-4">
            <div className="w-16 h-16 rounded-full bg-muted/60 flex items-center justify-center mx-auto">
              <Heart className="h-7 w-7 text-muted-foreground" />
            </div>
            <div>
              <p className="text-lg font-medium mb-1">Пока пусто</p>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                Нажмите на сердечко на карточке тура, чтобы сохранить его в избранное
              </p>
            </div>
            {emptyAction}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground">Ничего не найдено по запросу &laquo;{searchQuery}&raquo;</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((card, i) => (
              <motion.div
                key={card.tour_id || i}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                layout
              >
                <TourCardComponent
                  card={card}
                  onDetails={onCardDetails}
                  onFavorite={onCardFavorite}
                  isFavorited={favoritedIds?.has(card.tour_id) ?? true}
                />
                <div className="flex items-center gap-2 mt-1.5 px-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleRefreshPrice(card); }}
                    disabled={isBulkRefreshing || refreshingIds.has(card.tour_id)}
                    className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-brand transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`h-3 w-3 ${refreshingIds.has(card.tour_id) ? "animate-spin" : ""}`} />
                    Обновить цену и наличие
                  </button>
                  {getRefreshLabel(
                    refreshResults[card.tour_id] ?? card._refreshStatus ?? null,
                    card._refreshMessage
                  ) && (
                    <span
                      className={`text-[10px] ${getRefreshTone(
                        refreshResults[card.tour_id] ?? card._refreshStatus ?? null
                      )}`}
                    >
                      {getRefreshLabel(
                        refreshResults[card.tour_id] ?? card._refreshStatus ?? null,
                        card._refreshMessage
                      )}
                    </span>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
