"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { fetchHealth, type HealthResponse } from "@/lib/api/copilot";
import { cn } from "@/lib/utils";

interface StatusChipProps {
  className?: string;
  /** В свернутом сайдбаре показываем только индикатор без подписи. */
  compact?: boolean;
}

export function StatusChip({ className, compact = false }: StatusChipProps) {
  const [health, setHealth] = useState<HealthResponse | null>(null);

  useEffect(() => {
    let active = true;
    const tick = () => {
      fetchHealth()
        .then((data) => {
          if (active) setHealth(data);
        })
        .catch(() => {
          if (active) setHealth({ status: "error" });
        });
    };
    tick();
    const id = setInterval(tick, 60_000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  if (!health) return null;

  const both = !!health.llm_configured && !!health.tourvisor_configured;
  const isError = health.status === "error";

  if (both) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 px-2 py-0.5",
          compact ? "text-[10px]" : "text-[11px] font-medium",
          className
        )}
        title={`LLM (${health.model || "n/a"}) + TourVisor подключены`}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        {compact ? "live" : "LLM + TourVisor"}
      </span>
    );
  }

  let label: string;
  if (isError) label = compact ? "off" : "Бэкенд недоступен";
  else if (!health.llm_configured && !health.tourvisor_configured)
    label = compact ? "demo" : "demo: нет ключей";
  else if (!health.llm_configured) label = compact ? "tv" : "Нет LLM";
  else label = compact ? "llm" : "Нет TourVisor";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-700 px-2 py-0.5",
        compact ? "text-[10px]" : "text-[11px] font-medium",
        className
      )}
      title={label}
    >
      <AlertTriangle className="h-3 w-3" />
      {label}
    </span>
  );
}
