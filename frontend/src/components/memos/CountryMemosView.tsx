"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Search,
  Globe,
  Plane,
  Coins,
  Languages,
  Bus,
  Smartphone,
  Plug,
  Droplets,
  Lightbulb,
  AlertOctagon,
  HelpCircle,
  Copy,
  Check,
  ArrowLeft,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface MemoSummary {
  country: string;
  slug: string;
  intro: string;
}

interface MemoFAQ {
  q: string;
  a: string;
}

interface MemoFull {
  country: string;
  slug: string;
  intro: string;
  climate: string;
  currency: string;
  language: string;
  transport: string;
  sim: string;
  electricity: string;
  water: string;
  tips: string[];
  dont: string[];
  faq: MemoFAQ[];
}

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8090";

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fallback */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    return true;
  } catch {
    return false;
  }
}

function memoToPlainText(m: MemoFull): string {
  const lines: string[] = [];
  lines.push(`📌 Памятка: ${m.country}`);
  lines.push("");
  lines.push(m.intro);
  lines.push("");
  lines.push(`🌡 Климат: ${m.climate}`);
  lines.push(`💰 Валюта: ${m.currency}`);
  lines.push(`🗣 Язык: ${m.language}`);
  lines.push(`🚌 Транспорт: ${m.transport}`);
  lines.push(`📱 Связь: ${m.sim}`);
  lines.push(`🔌 Электричество: ${m.electricity}`);
  lines.push(`💧 Вода: ${m.water}`);
  lines.push("");
  if (m.tips?.length) {
    lines.push("✅ Советы:");
    m.tips.forEach((t) => lines.push(`• ${t}`));
    lines.push("");
  }
  if (m.dont?.length) {
    lines.push("⚠️ Чего не делать:");
    m.dont.forEach((t) => lines.push(`• ${t}`));
    lines.push("");
  }
  if (m.faq?.length) {
    lines.push("❓ FAQ:");
    m.faq.forEach((f) => {
      lines.push(`Q: ${f.q}`);
      lines.push(`A: ${f.a}`);
    });
  }
  return lines.join("\n");
}

export function CountryMemosView() {
  const [items, setItems] = useState<MemoSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [memo, setMemo] = useState<MemoFull | null>(null);
  const [memoLoading, setMemoLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch(`${API}/api/copilot/country-memos`)
      .then((r) => r.json())
      .then((data) => setItems(data.items || []))
      .catch(() => setError("Не удалось загрузить памятки"));
  }, []);

  useEffect(() => {
    if (!activeSlug) return;
    setMemoLoading(true);
    setMemo(null);
    fetch(`${API}/api/copilot/country-memos/${encodeURIComponent(activeSlug)}`)
      .then((r) => r.json())
      .then((data) => setMemo(data))
      .catch(() => setError("Памятка не найдена"))
      .finally(() => setMemoLoading(false));
  }, [activeSlug]);

  const filtered = useMemo(() => {
    if (!items) return [];
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) =>
        i.country.toLowerCase().includes(q) ||
        i.intro.toLowerCase().includes(q)
    );
  }, [items, query]);

  /* ── List view ── */
  if (!activeSlug) {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
          <header className="space-y-2">
            <div className="inline-flex items-center gap-2 text-sm text-brand">
              <BookOpen className="h-4 w-4" />
              Памятки направлений
            </div>
            <h1 className="text-2xl font-bold leading-tight">
              Готовые шпаргалки для клиента
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Базовое: виза, валюта, транспорт, советы, FAQ. Нажмите на
              страну — откроется полная памятка с кнопкой «Скопировать»,
              чтобы отправить клиенту в мессенджер.
            </p>
          </header>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              placeholder="Поиск по стране или описанию…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-xl border border-border bg-background pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
            />
          </div>

          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
              {error}
            </div>
          )}

          {!items && !error && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Загружаю…
            </div>
          )}

          {items && filtered.length === 0 && (
            <div className="rounded-xl border border-dashed border-border bg-muted/40 p-8 text-center text-sm text-muted-foreground">
              По запросу «{query}» памяток не нашлось.
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filtered.map((m) => (
              <button
                key={m.slug}
                onClick={() => setActiveSlug(m.slug)}
                className="group rounded-xl border border-border bg-card p-4 text-left transition-all hover:border-brand/40 hover:bg-brand/[0.02] hover:shadow-sm"
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <Globe className="h-4 w-4 text-brand" />
                  <h3 className="text-base font-semibold leading-tight">
                    {m.country}
                  </h3>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                  {m.intro}
                </p>
                <p className="mt-2 text-[11px] text-brand/80 group-hover:text-brand transition-colors">
                  Открыть памятку →
                </p>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ── Detail view ── */
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl px-4 py-8 space-y-5">
        <button
          onClick={() => {
            setActiveSlug(null);
            setMemo(null);
            setCopied(false);
          }}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          К списку памяток
        </button>

        {memoLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Загружаю памятку…
          </div>
        )}

        {memo && (
          <>
            <header className="flex items-start justify-between gap-3">
              <div>
                <div className="inline-flex items-center gap-2 text-sm text-brand mb-1">
                  <Globe className="h-4 w-4" />
                  Памятка
                </div>
                <h1 className="text-3xl font-bold leading-tight">
                  {memo.country}
                </h1>
              </div>
              <button
                onClick={async () => {
                  const ok = await copyToClipboard(memoToPlainText(memo));
                  if (ok) {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2400);
                  }
                }}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition",
                  copied
                    ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                    : "border-border bg-background text-muted-foreground hover:border-brand/40 hover:text-brand"
                )}
              >
                {copied ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                {copied ? "Скопировано" : "Копировать всё"}
              </button>
            </header>

            <p className="text-base text-foreground/85 leading-relaxed">
              {memo.intro}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FactCard icon={Plane} label="Климат" body={memo.climate} />
              <FactCard icon={Coins} label="Валюта" body={memo.currency} />
              <FactCard icon={Languages} label="Язык" body={memo.language} />
              <FactCard icon={Bus} label="Транспорт" body={memo.transport} />
              <FactCard icon={Smartphone} label="Связь" body={memo.sim} />
              <FactCard icon={Plug} label="Электричество" body={memo.electricity} />
              <FactCard icon={Droplets} label="Вода" body={memo.water} />
            </div>

            {memo.tips?.length > 0 && (
              <ListBlock
                icon={Lightbulb}
                title="Советы"
                tone="emerald"
                items={memo.tips}
              />
            )}
            {memo.dont?.length > 0 && (
              <ListBlock
                icon={AlertOctagon}
                title="Чего не делать"
                tone="amber"
                items={memo.dont}
              />
            )}

            {memo.faq?.length > 0 && (
              <div className="rounded-xl border border-border/60 bg-background overflow-hidden">
                <div className="px-4 py-3 border-b border-border/40 flex items-center gap-2">
                  <HelpCircle className="h-4 w-4 text-brand" />
                  <h2 className="text-sm font-semibold">FAQ</h2>
                </div>
                <ul className="divide-y divide-border/40">
                  {memo.faq.map((f, i) => (
                    <li key={i} className="px-4 py-3 space-y-1">
                      <p className="text-[13px] font-semibold leading-snug">
                        {f.q}
                      </p>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {f.a}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function FactCard({
  icon: Icon,
  label,
  body,
}: {
  icon: React.ElementType;
  label: string;
  body: string;
}) {
  return (
    <div className="rounded-xl border border-border/50 bg-background p-3.5 space-y-1">
      <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5 text-brand" />
        {label}
      </div>
      <p className="text-sm leading-snug">{body}</p>
    </div>
  );
}

function ListBlock({
  icon: Icon,
  title,
  items,
  tone,
}: {
  icon: React.ElementType;
  title: string;
  items: string[];
  tone: "emerald" | "amber";
}) {
  const styles =
    tone === "emerald"
      ? "border-emerald-200 bg-emerald-50/50"
      : "border-amber-200 bg-amber-50/50";
  const iconStyles =
    tone === "emerald" ? "text-emerald-600" : "text-amber-700";
  return (
    <div className={cn("rounded-xl border p-4 space-y-2", styles)}>
      <div className="flex items-center gap-2">
        <Icon className={cn("h-4 w-4", iconStyles)} />
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      <ul className="space-y-1.5 text-sm leading-relaxed">
        {items.map((t, i) => (
          <li key={i} className="flex gap-2">
            <span className="text-muted-foreground">•</span>
            <span>{t}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
