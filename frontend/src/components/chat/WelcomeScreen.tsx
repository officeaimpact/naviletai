"use client";

import { InputBar } from "./InputBar";
import { motion } from "framer-motion";

const SUGGESTIONS = [
  {
    emoji: "👨‍👩‍👧",
    text: "Семья 2+1, ребёнку 6, Турция из Москвы в начале июня, 4-5★, всё включено, до 300к",
  },
  {
    emoji: "🏖",
    text: "Из Москвы в Египет, 7 ночей, конец октября, 4-5★ на первой линии, всё включено, до 200 000 ₽ за двоих",
  },
  {
    emoji: "🔥",
    text: "Горящие туры из Москвы — что есть прямо сейчас",
  },
  {
    emoji: "📋",
    text: "Вот переписка с клиентом — собери короткое ТЗ по шаблону, не запускай поиск",
  },
];

interface WelcomeScreenProps {
  onSend: (message: string) => void;
  isLoading?: boolean;
}

export function WelcomeScreen({ onSend, isLoading }: WelcomeScreenProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="text-center mb-10"
      >
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight leading-snug">
          Привет, я помогу подобрать
          <br className="hidden sm:inline" />
          {" "}твоему клиенту лучшее путешествие
        </h1>
        <p className="text-sm text-muted-foreground mt-3">
          Свободный диалог по запросу клиента · 100+ туроператоров TourVisor · подборка для отправки клиенту
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15, ease: "easeOut" }}
        className="w-full max-w-2xl mb-6"
      >
        <InputBar onSend={onSend} isLoading={isLoading} centered />
      </motion.div>

      <div className="flex flex-wrap justify-center gap-2 max-w-2xl">
        {SUGGESTIONS.map((s, i) => (
          <motion.button
            key={s.text}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.3 + i * 0.06, ease: "easeOut" }}
            onClick={() => onSend(s.text)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full
                       border border-border bg-white text-sm text-foreground
                       hover:bg-muted hover:-translate-y-0.5 hover:shadow-sm
                       active:scale-95 transition-all duration-150"
          >
            <span>{s.emoji}</span>
            <span>{s.text}</span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
