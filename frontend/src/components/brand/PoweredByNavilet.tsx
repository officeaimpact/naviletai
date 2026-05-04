import Image from "next/image";

import { cn } from "@/lib/utils";

const NAVILET_LOGO = {
  src: "/brand/navilet-ai-logo.svg",
  width: 881,
  height: 195,
};

interface PoweredByNaviletProps {
  className?: string;
  /** Вариант: 'compact' — иконка + короткий текст; 'inline' — без обводки. */
  variant?: "compact" | "inline";
}

/**
 * Атрибуция «Сделано в сотрудничестве с Навылет! AI».
 * Рендерится мелким шрифтом + миниатюрный логотип Навылет AI справа.
 */
export function PoweredByNavilet({
  className,
  variant = "compact",
}: PoweredByNaviletProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 select-none",
        variant === "compact"
          ? "rounded-full border border-border/60 bg-background/80 px-3 py-1.5 backdrop-blur"
          : "",
        className
      )}
      aria-label="Сделано в сотрудничестве с Навылет! AI"
      title="Сделано в сотрудничестве с Навылет! AI"
    >
      <span className="text-[11px] font-medium text-muted-foreground/80 leading-none">
        Сделано в сотрудничестве с
      </span>
      <a
        href="https://navilet.ru"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center transition-opacity hover:opacity-80"
        aria-label="Перейти на navilet.ru"
      >
        <Image
          src={NAVILET_LOGO.src}
          alt="Навылет! AI"
          width={NAVILET_LOGO.width}
          height={NAVILET_LOGO.height}
          sizes="(max-width: 768px) 80px, 96px"
          className="h-4 w-auto object-contain"
          draggable={false}
        />
      </a>
    </div>
  );
}
