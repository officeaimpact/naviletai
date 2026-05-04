"use client";

import { useEffect, useRef, useState } from "react";
import { UserCircle2, Pencil, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface ClientProfileChipProps {
  profile: string | null;
  onClear: () => void | Promise<void>;
  onUpdate: (profile: string) => void | Promise<void>;
}

/**
 * Чип «Профиль клиента» над инпутом. Показывает короткое summary,
 * накопленное backend-ом из переписки агента (см. CopilotSession.client_profile).
 *
 * UX:
 *  - чип появляется только когда profile != null;
 *  - «Карандашик» открывает inline-редактор (textarea, max 200 симв.);
 *  - «×» полностью скрывает чип и сбрасывает профиль на стороне backend.
 */
export function ClientProfileChip({
  profile,
  onClear,
  onUpdate,
}: ClientProfileChipProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(profile ?? "");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!isEditing) setDraft(profile ?? "");
  }, [profile, isEditing]);

  useEffect(() => {
    if (isEditing) textareaRef.current?.focus();
  }, [isEditing]);

  if (!profile && !isEditing) return null;

  const handleSave = async () => {
    const trimmed = draft.trim().slice(0, 200);
    setIsEditing(false);
    if (trimmed !== (profile ?? "")) {
      await onUpdate(trimmed);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setDraft(profile ?? "");
  };

  return (
    <div
      className={cn(
        "mx-auto w-full max-w-3xl px-3 sm:px-4",
        "pb-1.5"
      )}
    >
      <div
        className={cn(
          "group flex items-start gap-2 rounded-2xl border border-brand/20 bg-brand/5",
          "px-3 py-2 text-sm text-foreground/90 shadow-sm"
        )}
      >
        <UserCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand" />

        {isEditing ? (
          <div className="flex flex-1 flex-col gap-1.5">
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value.slice(0, 200))}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void handleSave();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  handleCancel();
                }
              }}
              rows={2}
              maxLength={200}
              className={cn(
                "w-full resize-none rounded-md border border-border bg-background",
                "px-2 py-1 text-[13px] leading-snug text-foreground",
                "outline-none focus:border-brand focus:ring-1 focus:ring-brand/40"
              )}
              placeholder="Например: семья с ребёнком 3 года, ищут спокойный all-inclusive"
            />
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">
                {draft.length}/200 · Enter — сохранить, Esc — отменить
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="rounded-md px-2 py-1 text-[12px] text-muted-foreground hover:bg-muted"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={() => void handleSave()}
                  className="inline-flex items-center gap-1 rounded-md bg-brand px-2 py-1 text-[12px] font-medium text-white hover:opacity-90"
                >
                  <Check className="h-3 w-3" /> Сохранить
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-1 flex-col">
              <span className="text-[11px] font-medium uppercase tracking-wide text-brand">
                Профиль клиента
              </span>
              <span className="text-[13px] leading-snug text-foreground">
                {profile}
              </span>
            </div>
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Редактировать профиль"
                title="Редактировать"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => void onClear()}
                className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Скрыть профиль клиента"
                title="Скрыть профиль"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
