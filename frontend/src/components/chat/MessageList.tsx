"use client";

import { useEffect, useRef } from "react";
import { ChatMessage, TourCard } from "@/lib/types";
import { TourCardComponent } from "@/components/cards/TourCard";
import { cn } from "@/lib/utils";
import { MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

interface MessageListProps {
  messages: ChatMessage[];
  isLoading?: boolean;
  onCardDetails?: (card: TourCard) => void;
  onCardFavorite?: (card: TourCard) => void;
  favoritedIds?: Set<string>;
  onShowMap?: (cards: TourCard[]) => void;
}

function TypingDots() {
  return (
    <div className="flex justify-start">
      <div className="flex items-center gap-1.5 py-3 px-1">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="w-2 h-2 rounded-full bg-brand"
            animate={{ y: [0, -6, 0] }}
            transition={{
              duration: 0.6,
              repeat: Infinity,
              delay: i * 0.15,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>
    </div>
  );
}

function MessageBubble({
  message,
  onCardDetails,
  onCardFavorite,
  favoritedIds,
  onShowMap,
}: {
  message: ChatMessage;
  onCardDetails?: (card: TourCard) => void;
  onCardFavorite?: (card: TourCard) => void;
  favoritedIds?: Set<string>;
  onShowMap?: (cards: TourCard[]) => void;
}) {
  const isUser = message.role === "user";
  const hasTourCards = message.tour_cards && message.tour_cards.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="space-y-3"
    >
      <div
        className={cn("flex w-full", isUser ? "justify-end" : "justify-start")}
      >
        <div
          className={cn(
            "max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
            isUser
              ? "bg-brand text-white"
              : "bg-muted/60 text-foreground border border-border/40"
          )}
        >
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>

      {hasTourCards && (
        <div className="space-y-3 max-w-3xl">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onShowMap?.(message.tour_cards!)}
            className="gap-1.5"
          >
            <MapPin className="h-3.5 w-3.5" />
            Посмотреть на карте
          </Button>

          {message.tour_cards!.map((card, i) => (
            <motion.div
              key={card.tour_id || i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.35,
                delay: i * 0.08,
                ease: "easeOut",
              }}
            >
              <TourCardComponent
                card={card}
                onDetails={onCardDetails}
                onFavorite={onCardFavorite}
                isFavorited={favoritedIds?.has(card.tour_id) ?? false}
              />
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

export function MessageList({
  messages,
  isLoading = false,
  onCardDetails,
  onCardFavorite,
  favoritedIds,
  onShowMap,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  return (
    <div className="flex-1 overflow-y-auto px-4">
      <div className="max-w-3xl mx-auto space-y-4 py-6">
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            onCardDetails={onCardDetails}
            onCardFavorite={onCardFavorite}
            favoritedIds={favoritedIds}
            onShowMap={onShowMap}
          />
        ))}
        {isLoading && <TypingDots />}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
