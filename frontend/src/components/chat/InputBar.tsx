"use client";

import { useState, useRef, KeyboardEvent } from "react";
import { Mic, Send } from "lucide-react";
import { cn } from "@/lib/utils";

interface InputBarProps {
  onSend: (message: string) => void;
  isLoading?: boolean;
  placeholder?: string;
  centered?: boolean;
}

export function InputBar({
  onSend,
  isLoading = false,
  placeholder = "Помоги мне найти билеты до Москвы",
  centered = false,
}: InputBarProps) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    if (!value.trim() || isLoading) return;
    onSend(value.trim());
    setValue("");
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const hasValue = value.trim().length > 0;

  return (
    <div
      className={cn(
        "w-full px-4 pb-4",
        centered ? "max-w-2xl mx-auto" : "max-w-3xl mx-auto"
      )}
    >
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
          className="shrink-0 p-1.5 text-muted-foreground hover:text-foreground
                     active:scale-90 transition-all duration-150"
          aria-label="Голосовой ввод"
        >
          <Mic className="h-5 w-5" />
        </button>

        <button
          type="button"
          onClick={handleSend}
          disabled={!hasValue || isLoading}
          className={cn(
            "shrink-0 p-2 rounded-full transition-all duration-200",
            hasValue && !isLoading
              ? "bg-brand text-white hover:bg-brand-dark scale-100 hover:scale-105 active:scale-95"
              : "bg-foreground/80 text-background scale-100"
          )}
          aria-label="Отправить"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
