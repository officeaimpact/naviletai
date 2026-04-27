"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { FavoritesView } from "@/components/favorites/FavoritesView";
import { useFavorites } from "@/hooks/useFavorites";

export default function FavoritesPage() {
  const router = useRouter();
  const { toggleFavorite, favoritedIds } = useFavorites();

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto p-6">
        <div className="mb-4">
          <Button variant="ghost" size="sm" onClick={() => router.push("/")} className="gap-1.5">
            <ArrowLeft className="h-4 w-4" />
            Назад
          </Button>
        </div>
        <FavoritesView
          onCardFavorite={toggleFavorite}
          favoritedIds={favoritedIds}
          emptyAction={
            <Button
              onClick={() => router.push("/")}
              className="bg-brand hover:bg-brand-dark text-white mt-2"
            >
              Начать поиск
            </Button>
          }
        />
      </div>
    </div>
  );
}
