"use client";

import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bookmark,
  Calendar,
  ChevronDown,
  ChevronUp,
  Eye,
  Pencil,
  RefreshCw,
  Share2,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { TourCardComponent } from "@/components/cards/TourCard";
import { TourCard } from "@/lib/types";
import { actualizeTour } from "@/lib/api";
import { createCollection, fetchCollectionStats, type CollectionStats } from "@/lib/api/copilot";
import {
  useSavedCollections,
  type SavedCollection,
} from "@/contexts/SavedCollectionsContext";
import { cn } from "@/lib/utils";

interface CollectionsViewProps {
  onCardDetails?: (card: TourCard) => void;
  onCardFavorite?: (card: TourCard) => void;
  favoritedIds?: Set<string>;
}

function formatRelativeDate(ms: number): string {
  const d = new Date(ms);
  const today = new Date();
  const sameDay =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();
  if (sameDay) return `Сегодня · ${d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}`;
  return d.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function CollectionCard({
  collection,
  onCardDetails,
  onCardFavorite,
  favoritedIds,
}: {
  collection: SavedCollection;
  onCardDetails?: (card: TourCard) => void;
  onCardFavorite?: (card: TourCard) => void;
  favoritedIds?: Set<string>;
}) {
  const {
    renameCollection,
    removeCollection,
    updateCollection,
    updateCardInCollection,
    removeCardFromCollection,
  } = useSavedCollections();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(collection.name);
  const [confirmDel, setConfirmDel] = useState(false);
  const [refreshingAll, setRefreshingAll] = useState(false);
  const [refreshingIds, setRefreshingIds] = useState<Set<string>>(new Set());
  const [shareState, setShareState] = useState<"idle" | "loading" | "ready" | "error">(
    "idle"
  );
  const [shareUrl, setShareUrl] = useState<string | null>(collection.shareUrl ?? null);
  const [stats, setStats] = useState<CollectionStats | null>(null);

  // Извлекаем collection_id из shareUrl (формат /share/<id> или /share/<id>/email).
  const shareCollectionId = (() => {
    if (!shareUrl) return null;
    const m = shareUrl.match(/\/share\/([A-Za-z0-9_-]+)/);
    return m ? m[1] : null;
  })();

  // Подгружаем stats при наличии shareUrl: один раз при открытии и затем
  // на каждое раскрытие, чтобы цифры были свежими.
  useEffect(() => {
    if (!shareCollectionId) {
      setStats(null);
      return;
    }
    let cancelled = false;
    fetchCollectionStats(shareCollectionId).then((s) => {
      if (!cancelled) setStats(s);
    });
    return () => {
      cancelled = true;
    };
  }, [shareCollectionId, open]);

  const cards = collection.cards;
  const minPrice = cards.length
    ? Math.min(...cards.map((c) => c.price || 0).filter((p) => p > 0))
    : 0;
  const summary =
    cards
      .slice(0, 2)
      .map((c) => c.hotel_name)
      .join(" · ") + (cards.length > 2 ? ` · и ещё ${cards.length - 2}` : "");

  const setRefreshing = (id: string, val: boolean) =>
    setRefreshingIds((prev) => {
      const next = new Set(prev);
      if (val) next.add(id);
      else next.delete(id);
      return next;
    });

  const handleRefreshOne = useCallback(
    async (card: TourCard) => {
      if (!card.tour_id) return;
      setRefreshing(card.tour_id, true);
      try {
        const r = await actualizeTour(card.tour_id);
        if (r.status === "ok" && typeof r.price === "number") {
          updateCardInCollection(collection.id, card.tour_id, {
            price: r.price,
            operator: r.operator ?? card.operator,
            _refreshStatus: "ok",
            _refreshMessage: r.message || "Цена обновлена",
          });
        } else {
          updateCardInCollection(collection.id, card.tour_id, {
            _refreshStatus: r.status,
            _refreshMessage:
              r.message ||
              (r.status === "expired"
                ? "Тур устарел"
                : r.status === "unavailable"
                  ? "Нет в наличии"
                  : "Не удалось обновить"),
          });
        }
      } catch {
        updateCardInCollection(collection.id, card.tour_id, {
          _refreshStatus: "error",
          _refreshMessage: "Не удалось обновить",
        });
      } finally {
        setRefreshing(card.tour_id, false);
      }
    },
    [collection.id, updateCardInCollection]
  );

  const handleRefreshAll = useCallback(async () => {
    if (cards.length === 0 || refreshingAll) return;
    setRefreshingAll(true);
    try {
      // Параллельность ограничиваем 2 запросами одновременно — это уже принято в useFavoritesRefresh.
      const queue = [...cards];
      const workers = Array.from(
        { length: Math.min(2, queue.length) },
        async () => {
          while (queue.length) {
            const next = queue.shift();
            if (next) await handleRefreshOne(next);
          }
        }
      );
      await Promise.all(workers);
    } finally {
      setRefreshingAll(false);
    }
  }, [cards, refreshingAll, handleRefreshOne]);

  const handleShare = useCallback(async () => {
    if (shareState === "loading") return;
    if (shareUrl && shareState === "ready") {
      try {
        await navigator.clipboard.writeText(shareUrl);
      } catch {}
      window.open(shareUrl, "_blank", "noopener,noreferrer");
      return;
    }
    setShareState("loading");
    try {
      const body = await createCollection(cards);
      setShareUrl(body.share_url);
      updateCollection(collection.id, { shareUrl: body.share_url });
      setShareState("ready");
      try {
        await navigator.clipboard.writeText(body.share_url);
      } catch {}
      window.open(body.share_url, "_blank", "noopener,noreferrer");
    } catch {
      setShareState("error");
      setTimeout(() => setShareState("idle"), 2400);
    }
  }, [cards, collection.id, shareState, shareUrl, updateCollection]);

  const handleSaveName = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setName(collection.name);
      setEditing(false);
      return;
    }
    if (trimmed !== collection.name) renameCollection(collection.id, trimmed);
    setEditing(false);
  };

  return (
    <div className="rounded-xl border border-border bg-background overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 flex items-start gap-3">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex-1 flex items-start gap-3 text-left min-w-0"
          aria-expanded={open}
        >
          <div className="h-9 w-9 rounded-lg bg-brand/10 flex items-center justify-center shrink-0">
            <Bookmark className="h-4 w-4 text-brand" />
          </div>
          <div className="min-w-0 flex-1">
            {editing ? (
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={handleSaveName}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveName();
                  if (e.key === "Escape") {
                    setName(collection.name);
                    setEditing(false);
                  }
                }}
                onClick={(e) => e.stopPropagation()}
                autoFocus
                maxLength={80}
                className="w-full rounded-md border border-brand/40 px-2 py-1 text-sm font-semibold outline-none focus:ring-2 focus:ring-brand/30"
              />
            ) : (
              <p className="text-sm font-semibold truncate">{collection.name}</p>
            )}
            <p className="text-[11px] text-muted-foreground truncate mt-0.5">
              {summary}
            </p>
            <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground/80">
              <span>
                {cards.length} {cards.length === 1 ? "тур" : cards.length < 5 ? "тура" : "туров"}
              </span>
              {minPrice > 0 && (
                <>
                  <span>·</span>
                  <span>от {minPrice.toLocaleString("ru-RU")} ₽</span>
                </>
              )}
              <span>·</span>
              <span className="inline-flex items-center gap-0.5">
                <Calendar className="h-3 w-3" />
                {formatRelativeDate(collection.updatedAt)}
              </span>
              {stats && stats.views > 0 && (
                <>
                  <span>·</span>
                  <span
                    className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 text-emerald-700 font-medium"
                    title={
                      stats.last_viewed_at
                        ? `Последний просмотр: ${new Date(stats.last_viewed_at * 1000).toLocaleString("ru-RU")}`
                        : "Подборка открывалась клиентом"
                    }
                  >
                    <Eye className="h-3 w-3" />
                    {stats.views}
                    {stats.unique_views > 1 && (
                      <span className="inline-flex items-center gap-0.5">
                        · <Users className="h-3 w-3" /> {stats.unique_views}
                      </span>
                    )}
                  </span>
                </>
              )}
            </div>
          </div>
        </button>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => {
              setName(collection.name);
              setEditing((v) => !v);
            }}
            className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors"
            title="Переименовать"
            aria-label="Переименовать подборку"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setConfirmDel((v) => !v)}
            className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-destructive transition-colors"
            title="Удалить подборку"
            aria-label="Удалить подборку"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground transition-colors"
            aria-label={open ? "Свернуть" : "Развернуть"}
          >
            {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Confirm delete */}
      <AnimatePresence>
        {confirmDel && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden border-t border-border/40"
          >
            <div className="px-4 py-3 bg-destructive/5 flex items-center justify-between gap-3">
              <p className="text-xs">Удалить подборку «{collection.name}»?</p>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => removeCollection(collection.id)}
                >
                  Удалить
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirmDel(false)}>
                  Отмена
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Body */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-border/50"
          >
            <div className="px-4 py-3 flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleRefreshAll}
                disabled={refreshingAll}
                className="gap-1.5"
                title="Обновить цены и наличие по всем турам подборки"
              >
                <RefreshCw className={cn("h-3.5 w-3.5", refreshingAll && "animate-spin")} />
                Обновить цены
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleShare}
                disabled={shareState === "loading" || cards.length === 0}
                className={cn(
                  "gap-1.5",
                  shareState === "ready" &&
                    "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                )}
                title="Создать публичную HTML-ссылку для клиента"
              >
                <Share2 className="h-3.5 w-3.5" />
                {shareState === "loading"
                  ? "Готовлю ссылку..."
                  : shareState === "ready"
                    ? "Открыть ссылку"
                    : shareState === "error"
                      ? "Не получилось"
                      : "Поделиться"}
              </Button>
              {shareUrl && (
                <span className="text-[10px] text-muted-foreground/80 truncate max-w-[260px]">
                  {shareUrl}
                </span>
              )}
            </div>
            <div className="p-4 pt-0 space-y-3">
              {cards.map((card) => (
                <div key={card.tour_id || card.hotel_name} className="space-y-1">
                  <TourCardComponent
                    card={card}
                    onDetails={onCardDetails}
                    onFavorite={onCardFavorite}
                    isFavorited={favoritedIds?.has(card.tour_id) ?? false}
                  />
                  <div className="flex items-center gap-3 px-1">
                    <button
                      onClick={() => handleRefreshOne(card)}
                      disabled={refreshingAll || refreshingIds.has(card.tour_id)}
                      className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-brand transition-colors disabled:opacity-50"
                    >
                      <RefreshCw
                        className={cn(
                          "h-3 w-3",
                          refreshingIds.has(card.tour_id) && "animate-spin"
                        )}
                      />
                      Обновить
                    </button>
                    {card._refreshMessage && (
                      <span
                        className={cn(
                          "text-[10px]",
                          card._refreshStatus === "ok" && "text-emerald-600",
                          card._refreshStatus === "expired" && "text-amber-600",
                          card._refreshStatus === "unavailable" && "text-rose-600",
                          card._refreshStatus === "error" && "text-rose-600"
                        )}
                      >
                        {card._refreshMessage}
                      </span>
                    )}
                    <button
                      onClick={() =>
                        removeCardFromCollection(collection.id, card.tour_id)
                      }
                      className="ml-auto inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-rose-600 transition-colors"
                      title="Убрать тур из подборки"
                    >
                      <X className="h-3 w-3" />
                      Убрать
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function CollectionsView({
  onCardDetails,
  onCardFavorite,
  favoritedIds,
}: CollectionsViewProps) {
  const { collections } = useSavedCollections();

  if (collections.length === 0) {
    return (
      <div className="text-center py-20 space-y-4">
        <div className="w-16 h-16 rounded-full bg-muted/60 flex items-center justify-center mx-auto">
          <Bookmark className="h-7 w-7 text-muted-foreground" />
        </div>
        <div>
          <p className="text-lg font-medium mb-1">Подборок пока нет</p>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            В чате выберите интересные туры через «Выбрать предложения» и нажмите «Сохранить» — подборка появится здесь.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {collections.map((c) => (
        <CollectionCard
          key={c.id}
          collection={c}
          onCardDetails={onCardDetails}
          onCardFavorite={onCardFavorite}
          favoritedIds={favoritedIds}
        />
      ))}
    </div>
  );
}
