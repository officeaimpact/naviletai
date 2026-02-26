"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Heart, Trash2 } from "lucide-react";
import { TourCard } from "@/lib/types";
import { TourCardComponent } from "@/components/cards/TourCard";
import { useFavorites } from "@/hooks/useFavorites";
import { motion, AnimatePresence } from "framer-motion";

interface FavoritesViewProps {
  onCardDetails?: (card: TourCard) => void;
  onCardFavorite?: (card: TourCard) => void;
  favoritedIds?: Set<string>;
}

export function FavoritesView({ onCardDetails, onCardFavorite, favoritedIds }: FavoritesViewProps) {
  const { favorites } = useFavorites();
  const [searchQuery, setSearchQuery] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);

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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold">Избранное</h1>
            {favorites.length > 0 && (
              <span className="text-sm text-muted-foreground">
                {favorites.length} {favorites.length === 1 ? "тур" : favorites.length < 5 ? "тура" : "туров"}
              </span>
            )}
          </div>
          {favorites.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmClear(true)}
              className="text-muted-foreground hover:text-destructive gap-1.5"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Очистить
            </Button>
          )}
        </div>

        {/* Confirm clear */}
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

        {/* Search */}
        {favorites.length > 2 && (
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
        {favorites.length === 0 ? (
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
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
