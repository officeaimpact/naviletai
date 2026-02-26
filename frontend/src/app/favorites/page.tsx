"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Search, Heart, Trash2 } from "lucide-react";
import { TourCardComponent } from "@/components/cards/TourCard";
import { useFavorites } from "@/hooks/useFavorites";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function FavoritesPage() {
  const router = useRouter();
  const { favorites, toggleFavorite, isFavorited } = useFavorites();
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
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => router.push("/")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
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
              className="overflow-hidden mb-4"
            >
              <div className="p-4 rounded-xl border border-destructive/30 bg-destructive/5 flex items-center justify-between">
                <p className="text-sm">Удалить все из избранного?</p>
                <div className="flex gap-2">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      favorites.forEach((c) => toggleFavorite(c));
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
          <div className="relative mb-6">
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
            <Button onClick={() => router.push("/")} className="bg-brand hover:bg-brand-dark text-white mt-2">
              Начать поиск
            </Button>
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
                  onFavorite={toggleFavorite}
                  isFavorited={isFavorited(card.tour_id)}
                />
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
