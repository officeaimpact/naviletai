"use client";

import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { Send, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface QuickAction {
  label: string;
  prompt: string;
}

interface InputBarProps {
  onSend: (message: string) => void;
  isLoading?: boolean;
  placeholder?: string;
  centered?: boolean;
  /** Опциональный ряд готовых промптов над инпутом (агентские быстрые действия). */
  quickActions?: QuickAction[];
}

export function InputBar({
  onSend,
  isLoading = false,
  placeholder = "Помоги мне найти билеты до Москвы",
  centered = false,
  quickActions,
}: InputBarProps) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const wasLoading = useRef(false);

  useEffect(() => {
    if (wasLoading.current && !isLoading) {
      inputRef.current?.focus();
    }
    wasLoading.current = isLoading;
  }, [isLoading]);

  const handleSend = () => {
    if (!value.trim() || isLoading) return;
    onSend(value.trim());
    setValue("");
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = () => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  };

  const hasValue = value.trim().length > 0;

  return (
    <div
      className={cn(
        "w-full px-4 pb-[max(1rem,env(safe-area-inset-bottom))]",
        centered ? "max-w-2xl mx-auto" : "max-w-3xl mx-auto"
      )}
    >
      {quickActions && quickActions.length > 0 ? (
        <div className="mb-2.5 flex flex-wrap gap-1.5">
          {quickActions.map((qa) => (
            <button
              key={qa.label}
              type="button"
              disabled={isLoading}
              onClick={() => {
                if (isLoading) return;
                onSend(qa.prompt);
              }}
              className="rounded-full border border-border bg-white px-3 py-1.5 text-[12px] font-medium text-muted-foreground transition hover:-translate-y-0.5 hover:border-brand/40 hover:bg-brand/5 hover:text-brand disabled:opacity-50"
              title={qa.prompt}
            >
              {qa.label}
            </button>
          ))}
        </div>
      ) : null}
      <div
        className="relative flex items-center gap-2 rounded-full
                   border-2 border-transparent bg-white shadow-sm
                   ring-1 ring-border
                   focus-within:ring-2 focus-within:ring-brand
                   focus-within:border-brand/20 focus-within:shadow-md
                   transition-all duration-200 px-5 py-2.5"
      >
        <textarea
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={isLoading}
          rows={1}
          className="flex-1 resize-none bg-transparent text-sm outline-none
                     placeholder:text-muted-foreground disabled:opacity-50
                     min-h-[24px] max-h-[120px]"
          style={{ fieldSizing: "content" } as React.CSSProperties}
        />

        <button
          type="button"
          onClick={handleSend}
          disabled={!hasValue || isLoading}
          className={cn(
            "shrink-0 p-2.5 rounded-full transition-all duration-200",
            hasValue && !isLoading
              ? "bg-brand text-white hover:bg-brand-dark scale-100 hover:scale-105 active:scale-95"
              : "bg-muted text-muted-foreground scale-100"
          )}
          aria-label="Отправить"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </button>
      </div>
    </div>
  );
}
