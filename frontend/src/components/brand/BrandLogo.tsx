import Image from "next/image";

import { cn } from "@/lib/utils";

const TOURVISOR_LOGO = {
  src: "/brand/tourvisor-ai-logo.png",
  width: 1024,
  height: 203,
};

interface BrandLogoProps {
  className?: string;
  imageClassName?: string;
  priority?: boolean;
}

export function BrandLogo({
  className,
  imageClassName,
  priority = false,
}: BrandLogoProps) {
  return (
    <span className={cn("inline-flex items-center overflow-hidden", className)}>
      <Image
        src={TOURVISOR_LOGO.src}
        alt="Tourvisor AI"
        width={TOURVISOR_LOGO.width}
        height={TOURVISOR_LOGO.height}
        priority={priority}
        sizes="(max-width: 768px) 160px, 224px"
        className={cn("h-full w-auto object-contain", imageClassName)}
        draggable={false}
      />
    </span>
  );
}
