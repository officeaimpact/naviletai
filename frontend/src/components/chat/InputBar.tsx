"use client";

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  KeyboardEvent,
  ChangeEvent,
  DragEvent,
  ClipboardEvent,
} from "react";
import { Send, Loader2, Paperclip, X as XIcon, ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { PoweredByNavilet } from "@/components/brand/PoweredByNavilet";

export interface QuickAction {
  label: string;
  prompt: string;
}

interface AttachedImage {
  id: string;
  name: string;
  dataUrl: string;
  sizeKb: number;
}

interface InputBarProps {
  onSend: (message: string, images?: string[]) => void;
  isLoading?: boolean;
  placeholder?: string;
  centered?: boolean;
  /** Опциональный ряд готовых промптов над инпутом (агентские быстрые действия). */
  quickActions?: QuickAction[];
}

const MAX_IMAGES = 4;
const MAX_BYTES_PER_IMAGE = 5 * 1024 * 1024; // 5 MB

function isImageFile(file: File): boolean {
  return file.type.startsWith("image/");
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read_failed"));
    reader.onload = () => resolve(String(reader.result || ""));
    reader.readAsDataURL(file);
  });
}

export function InputBar({
  onSend,
  isLoading = false,
  placeholder = "Помоги мне найти билеты до Москвы",
  centered = false,
  quickActions,
}: InputBarProps) {
  const [value, setValue] = useState("");
  const [attached, setAttached] = useState<AttachedImage[]>([]);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const wasLoading = useRef(false);
  const dragCounter = useRef(0);

  useEffect(() => {
    if (wasLoading.current && !isLoading) {
      inputRef.current?.focus();
    }
    wasLoading.current = isLoading;
  }, [isLoading]);

  const addFiles = useCallback(
    async (files: FileList | File[]) => {
      const incoming = Array.from(files).filter(isImageFile);
      if (incoming.length === 0) {
        setAttachError("Поддерживаются только изображения");
        return;
      }
      const room = MAX_IMAGES - attached.length;
      if (room <= 0) {
        setAttachError(`Максимум ${MAX_IMAGES} картинок`);
        return;
      }
      setAttachError(null);
      const next: AttachedImage[] = [];
      for (const file of incoming.slice(0, room)) {
        if (file.size > MAX_BYTES_PER_IMAGE) {
          setAttachError(`«${file.name}» слишком большая (макс ${Math.round(MAX_BYTES_PER_IMAGE / 1024 / 1024)} MB)`);
          continue;
        }
        try {
          const dataUrl = await readAsDataUrl(file);
          next.push({
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            name: file.name || "screenshot",
            dataUrl,
            sizeKb: Math.round(file.size / 1024),
          });
        } catch {
          setAttachError(`Не удалось прочитать «${file.name}»`);
        }
      }
      if (next.length > 0) {
        setAttached((prev) => [...prev, ...next].slice(0, MAX_IMAGES));
      }
    },
    [attached.length]
  );

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    void addFiles(e.target.files);
    e.target.value = "";
  };

  const removeAttached = (id: string) => {
    setAttached((prev) => prev.filter((a) => a.id !== id));
  };

  const handleSend = () => {
    const trimmed = value.trim();
    const hasImages = attached.length > 0;
    if ((!trimmed && !hasImages) || isLoading) return;
    onSend(trimmed, hasImages ? attached.map((a) => a.dataUrl) : undefined);
    setValue("");
    setAttached([]);
    setAttachError(null);
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

  // Drag & drop поверх всего инпут-блока. Используем counter, потому что
  // dragenter/dragleave срабатывают на каждом дочернем элементе.
  const handleDragEnter = (e: DragEvent) => {
    e.preventDefault();
    if (Array.from(e.dataTransfer?.types || []).includes("Files")) {
      dragCounter.current += 1;
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    dragCounter.current = Math.max(0, dragCounter.current - 1);
    if (dragCounter.current === 0) setIsDragging(false);
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    dragCounter.current = 0;
    setIsDragging(false);
    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      void addFiles(e.dataTransfer.files);
    }
  };

  // Paste из буфера обмена (Cmd+V со скриншотом).
  const handlePaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === "file") {
        const f = item.getAsFile();
        if (f && isImageFile(f)) files.push(f);
      }
    }
    if (files.length > 0) {
      e.preventDefault();
      void addFiles(files);
    }
  };

  const hasValue = value.trim().length > 0;
  const hasImages = attached.length > 0;
  const canSend = (hasValue || hasImages) && !isLoading;

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

      {/* Превью прикреплённых изображений. */}
      {hasImages ? (
        <div className="mb-2 flex flex-wrap gap-2">
          {attached.map((img) => (
            <div
              key={img.id}
              className="group relative h-16 w-16 overflow-hidden rounded-lg border border-border bg-muted/40"
              title={`${img.name} · ${img.sizeKb} KB`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.dataUrl}
                alt={img.name}
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                onClick={() => removeAttached(img.id)}
                className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white opacity-90 transition hover:bg-black/80 group-hover:opacity-100"
                aria-label={`Удалить ${img.name}`}
              >
                <XIcon className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {attachError ? (
        <div className="mb-1.5 text-[12px] text-destructive">{attachError}</div>
      ) : null}

      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={cn(
          "relative flex items-center gap-2 rounded-full",
          "border-2 border-transparent bg-white shadow-sm",
          "ring-1 ring-border",
          "focus-within:ring-2 focus-within:ring-brand",
          "focus-within:border-brand/20 focus-within:shadow-md",
          "transition-all duration-200 px-2.5 sm:px-3 py-2.5",
          isDragging && "ring-2 ring-brand bg-brand/5"
        )}
      >
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFileInputChange}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={isLoading || attached.length >= MAX_IMAGES}
          className={cn(
            "shrink-0 rounded-full p-2 text-muted-foreground transition",
            "hover:bg-muted hover:text-foreground",
            "disabled:opacity-40 disabled:cursor-not-allowed"
          )}
          aria-label="Прикрепить изображение"
          title={
            attached.length >= MAX_IMAGES
              ? `Максимум ${MAX_IMAGES} картинок`
              : "Прикрепить скриншот переписки"
          }
        >
          <Paperclip className="h-4 w-4" />
        </button>

        <textarea
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
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
          disabled={!canSend}
          className={cn(
            "shrink-0 p-2.5 rounded-full transition-all duration-200",
            canSend
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

        {/* Drop overlay. Показывается, когда тащим файлы поверх инпута. */}
        {isDragging ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-full bg-brand/10 backdrop-blur-[1px]">
            <span className="flex items-center gap-1.5 text-xs font-medium text-brand">
              <ImageIcon className="h-3.5 w-3.5" /> Отпустите, чтобы прикрепить
            </span>
          </div>
        ) : null}
      </div>

      {/* Атрибуция партнёра — мелкая строка под полем ввода. */}
      {!centered && (
        <div className="mt-1.5 flex justify-center">
          <PoweredByNavilet variant="inline" />
        </div>
      )}
    </div>
  );
}
