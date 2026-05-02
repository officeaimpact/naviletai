"use client";

import { useEffect, useRef, useState } from "react";
import { ChatMessage, TourCard } from "@/lib/types";
import { TourCardComponent } from "@/components/cards/TourCard";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  Check,
  CheckSquare,
  Copy,
  ListChecks,
  MapPin,
  Share2,
  Square,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { createCollection } from "@/lib/api/copilot";

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fallback below */
  }
  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
    return true;
  } catch {
    return false;
  }
}

function CopyMessageButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        const ok = await copyToClipboard(text);
        if (ok) {
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        }
      }}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition",
        copied
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-border bg-background text-muted-foreground hover:border-brand/40 hover:text-brand"
      )}
      title={copied ? "Скопировано" : "Скопировать ответ"}
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {copied ? "Скопировано" : "Копировать"}
    </button>
  );
}

function ShareCollectionButton({ cards }: { cards: TourCard[] }) {
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">(
    "idle"
  );
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  const handle = async () => {
    if (state === "loading") return;
    if (shareUrl && state === "ready") {
      await copyToClipboard(shareUrl);
      window.open(shareUrl, "_blank", "noopener,noreferrer");
      return;
    }
    setState("loading");
    try {
      const body = await createCollection(cards);
      setShareUrl(body.share_url);
      setState("ready");
      await copyToClipboard(body.share_url);
      window.open(body.share_url, "_blank", "noopener,noreferrer");
    } catch {
      setState("error");
      setTimeout(() => setState("idle"), 2400);
    }
  };

  let label: string;
  if (state === "loading") label = "Готовлю ссылку...";
  else if (state === "ready") label = "Ссылка скопирована";
  else if (state === "error") label = "Не получилось — повторите";
  else label = `Поделиться подборкой (${cards.length})`;

  return (
    <button
      type="button"
      onClick={handle}
      disabled={state === "loading"}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition disabled:opacity-60",
        state === "ready"
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : state === "error"
          ? "border-rose-200 bg-rose-50 text-rose-700"
          : "border-border bg-background text-muted-foreground hover:border-brand/40 hover:text-brand"
      )}
      title="Создать публичную HTML-подборку для клиента"
    >
      {state === "ready" ? (
        <Check className="h-3 w-3" />
      ) : (
        <Share2 className="h-3 w-3" />
      )}
      {label}
    </button>
  );
}

interface MessageListProps {
  messages: ChatMessage[];
  isLoading?: boolean;
  onCardDetails?: (card: TourCard) => void;
  onCardFavorite?: (card: TourCard) => void;
  favoritedIds?: Set<string>;
  onShowMap?: (cards: TourCard[]) => void;
  /** Финальная подборка из выбранных карточек: ассистент кладёт их в чат
   *  как новое сообщение с бейджем «Финальная подборка» и share-кнопкой. */
  onCollectFinal?: (cards: TourCard[]) => void;
}

const STATUS_PHASES = [
  { delay: 0, text: "Обрабатываю запрос..." },
  { delay: 3000, text: "Анализирую параметры..." },
  { delay: 8000, text: "Ищу подходящие варианты..." },
  { delay: 15000, text: "Сравниваю предложения..." },
  { delay: 25000, text: "Подбираю лучшие туры..." },
];

function TypingIndicator() {
  const [phaseIndex, setPhaseIndex] = useState(0);

  useEffect(() => {
    const timers = STATUS_PHASES.slice(1).map((phase, i) =>
      setTimeout(() => setPhaseIndex(i + 1), phase.delay)
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="flex justify-start">
      <div className="flex flex-col items-start gap-1 py-3 px-1">
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="w-2 h-2 rounded-full bg-brand"
              animate={{ scale: [1, 1.3, 1], opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
            />
          ))}
        </div>
        <AnimatePresence mode="wait">
          <motion.p
            key={phaseIndex}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.3 }}
            className="text-xs text-muted-foreground"
          >
            {STATUS_PHASES[phaseIndex].text}
          </motion.p>
        </AnimatePresence>
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
  onCollectFinal,
}: {
  message: ChatMessage;
  onCardDetails?: (card: TourCard) => void;
  onCardFavorite?: (card: TourCard) => void;
  favoritedIds?: Set<string>;
  onShowMap?: (cards: TourCard[]) => void;
  onCollectFinal?: (cards: TourCard[]) => void;
}) {
  const isUser = message.role === "user";
  const hasTourCards = message.tour_cards && message.tour_cards.length > 0;
  const cascadePhase = !!message.cascade_phase;
  const slotEntries =
    message.slots && Object.keys(message.slots).length > 0
      ? Object.entries(message.slots)
      : [];
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const cards = message.tour_cards || [];
  const selectedCards = cards.filter((c) => selectedIds.has(c.tour_id));

  const exitSelection = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  const toggleSelected = (tourId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(tourId)) next.delete(tourId);
      else next.add(tourId);
      return next;
    });
  };

  const handleSubmitSelection = () => {
    if (selectedCards.length === 0 || !onCollectFinal) return;
    onCollectFinal(selectedCards);
    exitSelection();
  };

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
            "flex max-w-[88%] flex-col gap-1.5 sm:max-w-[75%]",
            isUser ? "items-end" : "items-start"
          )}
        >
          <div
            className={cn(
              "rounded-2xl px-4 py-3 text-sm leading-relaxed",
              isUser
                ? "bg-brand text-white"
                : "bg-muted/60 text-foreground border border-border/40"
            )}
          >
            <p className="whitespace-pre-wrap">{message.content}</p>
            {!isUser && message.cascade_missing ? (
              <div className="mt-2 inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                <AlertTriangle className="h-3 w-3" />
                Жду параметр: {message.cascade_missing}
              </div>
            ) : null}
            {!isUser && cascadePhase && slotEntries.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-1 text-[11px] text-muted-foreground">
                {slotEntries.map(([k, v]) => (
                  <span
                    key={k}
                    className="rounded bg-background/80 px-1.5 py-0.5 border border-border/40"
                  >
                    {k}: {v}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
          {!isUser && message.content ? (
            <div className="ml-1 flex flex-wrap items-center gap-1.5">
              <CopyMessageButton text={message.content} />
              {hasTourCards ? (
                <ShareCollectionButton cards={message.tour_cards!} />
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {hasTourCards && (
        <div className="space-y-3 max-w-3xl">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs text-muted-foreground">
              {selectionMode
                ? `Выбрано ${selectedIds.size} из ${cards.length}`
                : `Найдено ${cards.length} вариантов`}
            </p>
            {!selectionMode && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onShowMap?.(cards)}
                className="gap-1.5"
              >
                <MapPin className="h-3.5 w-3.5" />
                На карте
              </Button>
            )}
            {!selectionMode && onCollectFinal && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectionMode(true)}
                className="gap-1.5 border-brand/40 text-brand hover:bg-brand/5"
              >
                <ListChecks className="h-3.5 w-3.5" />
                Выбрать предложения
              </Button>
            )}
            {selectionMode && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exitSelection}
                  className="gap-1.5"
                >
                  <X className="h-3.5 w-3.5" />
                  Отмена
                </Button>
                <Button
                  size="sm"
                  onClick={handleSubmitSelection}
                  disabled={selectedCards.length === 0}
                  className="gap-1.5 bg-brand text-white hover:bg-brand-dark disabled:opacity-50"
                >
                  <Check className="h-3.5 w-3.5" />
                  Собрать подборку{selectedCards.length > 0 ? ` (${selectedCards.length})` : ""}
                </Button>
              </>
            )}
          </div>

          {cards.map((card, i) => {
            const isSelected = selectedIds.has(card.tour_id);
            return (
              <motion.div
                key={card.tour_id || i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.35,
                  delay: i * 0.08,
                  ease: "easeOut",
                }}
                className={cn("relative", selectionMode && "rounded-xl")}
                onClick={selectionMode ? () => toggleSelected(card.tour_id) : undefined}
                role={selectionMode ? "button" : undefined}
                aria-pressed={selectionMode ? isSelected : undefined}
                style={selectionMode ? { cursor: "pointer" } : undefined}
              >
                <div
                  className={cn(
                    "transition-all",
                    selectionMode &&
                      (isSelected
                        ? "ring-2 ring-brand rounded-xl"
                        : "ring-1 ring-border/60 hover:ring-brand/40 rounded-xl"),
                    selectionMode && "pointer-events-none"
                  )}
                >
                  <TourCardComponent
                    card={card}
                    onDetails={onCardDetails}
                    onFavorite={onCardFavorite}
                    isFavorited={favoritedIds?.has(card.tour_id) ?? false}
                  />
                </div>
                {selectionMode && (
                  <div
                    className={cn(
                      "absolute top-3 right-3 z-10 flex h-7 w-7 items-center justify-center rounded-full border-2 transition-colors",
                      isSelected
                        ? "border-brand bg-brand text-white"
                        : "border-border bg-white text-muted-foreground"
                    )}
                  >
                    {isSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                  </div>
                )}
              </motion.div>
            );
          })}
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
  onCollectFinal,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const threshold = 150;
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
    if (isNearBottom || isLoading) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading]);

  return (
    <div ref={scrollContainerRef} className="flex-1 overflow-y-auto overscroll-contain px-4">
      <div className="max-w-3xl mx-auto space-y-4 py-6">
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            onCardDetails={onCardDetails}
            onCardFavorite={onCardFavorite}
            favoritedIds={favoritedIds}
            onShowMap={onShowMap}
            onCollectFinal={onCollectFinal}
          />
        ))}
        {isLoading && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
