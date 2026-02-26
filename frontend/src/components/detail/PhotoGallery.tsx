"use client";

import { useEffect, useCallback, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface PhotoGalleryProps {
  images: string[];
  startIndex?: number;
  onClose: () => void;
}

export function PhotoGallery({ images, startIndex = 0, onClose }: PhotoGalleryProps) {
  const [current, setCurrent] = useState(startIndex);
  const [direction, setDirection] = useState(0);

  const goTo = useCallback(
    (idx: number, dir: number) => {
      setDirection(dir);
      setCurrent(((idx % images.length) + images.length) % images.length);
    },
    [images.length]
  );

  const prev = useCallback(() => goTo(current - 1, -1), [current, goTo]);
  const next = useCallback(() => goTo(current + 1, 1), [current, goTo]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, prev, next]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  // Preload adjacent images
  useEffect(() => {
    const preload = (idx: number) => {
      const i = ((idx % images.length) + images.length) % images.length;
      const img = new Image();
      img.src = images[i];
    };
    preload(current + 1);
    preload(current - 1);
  }, [current, images]);

  const variants = {
    enter: (dir: number) => ({ x: dir > 0 ? 300 : -300, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? -300 : 300, opacity: 0 }),
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/90 flex flex-col"
      onClick={onClose}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between p-4 text-white">
        <span className="text-sm font-medium">
          {current + 1} / {images.length}
        </span>
        <button
          onClick={onClose}
          className="p-2 hover:bg-white/10 rounded-lg transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Main image area */}
      <div
        className="flex-1 flex items-center justify-center relative px-16 min-h-0"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Prev arrow */}
        <button
          onClick={prev}
          className="absolute left-4 p-3 rounded-full bg-white/10 hover:bg-white/20
                     text-white transition-colors z-10"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>

        {/* Image with crossfade */}
        <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
          <AnimatePresence custom={direction} mode="popLayout">
            <motion.img
              key={current}
              src={images[current]}
              alt={`Photo ${current + 1}`}
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className="max-w-full max-h-full object-contain rounded-lg"
              draggable={false}
            />
          </AnimatePresence>
        </div>

        {/* Next arrow */}
        <button
          onClick={next}
          className="absolute right-4 p-3 rounded-full bg-white/10 hover:bg-white/20
                     text-white transition-colors z-10"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      </div>

      {/* Thumbnail strip */}
      <div
        className="p-4 flex justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex gap-2 overflow-x-auto max-w-[90vw] py-1 px-1">
          {images.map((url, i) => (
            <button
              key={i}
              onClick={() => goTo(i, i > current ? 1 : -1)}
              className={cn(
                "w-16 h-12 rounded-md overflow-hidden shrink-0 border-2 transition-all",
                i === current
                  ? "border-white opacity-100 scale-105"
                  : "border-transparent opacity-50 hover:opacity-80"
              )}
            >
              <img
                src={url}
                alt={`Thumb ${i + 1}`}
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
