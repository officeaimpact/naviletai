"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Bookmark, X } from "lucide-react";
import { TourCard } from "@/lib/types";

interface SaveCollectionModalProps {
  cards: TourCard[];
  defaultName?: string;
  onClose: () => void;
  onSave: (name: string) => void;
}

/** Минималистичный модал, в котором агент задаёт имя подборки.
 *  Поле автофокусируется, Enter — сохранение, Esc — закрытие. */
export function SaveCollectionModal({
  cards,
  defaultName,
  onClose,
  onSave,
}: SaveCollectionModalProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(defaultName || "");

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleSubmit = () => {
    onSave(name.trim() || defaultName?.trim() || "Подборка");
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 8 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 8 }}
        transition={{ type: "spring", damping: 28, stiffness: 360 }}
        className="relative w-full max-w-md bg-background rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Bookmark className="h-4 w-4 text-brand" />
            <h3 className="text-sm font-semibold">Сохранить подборку в избранное</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-muted rounded-lg transition-colors"
            aria-label="Закрыть"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="collection-name">
              Название подборки
            </label>
            <input
              id="collection-name"
              ref={inputRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder={defaultName || "Например: Турция для Ивановых, июнь 5★"}
              maxLength={80}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
            <p className="text-[11px] text-muted-foreground/80">
              Это название увидите только вы — в разделе «Избранное → Подборки». Подборку всегда можно переименовать.
            </p>
          </div>

          <div className="rounded-xl border border-border/40 bg-muted/30 px-3 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
              {cards.length} {cards.length === 1 ? "вариант" : cards.length < 5 ? "варианта" : "вариантов"}
            </p>
            <ul className="space-y-1 text-xs text-foreground/85">
              {cards.slice(0, 4).map((c) => (
                <li key={c.tour_id} className="truncate">
                  · {c.hotel_name} {c.hotel_stars ? `${c.hotel_stars}★` : ""} — {c.country}, {c.resort}
                </li>
              ))}
              {cards.length > 4 && (
                <li className="text-muted-foreground">
                  и ещё {cards.length - 4}
                </li>
              )}
            </ul>
          </div>

          <div className="flex items-center gap-2 justify-end pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className="rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-dark"
            >
              Сохранить
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
