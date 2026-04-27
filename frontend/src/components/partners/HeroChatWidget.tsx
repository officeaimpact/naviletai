"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState, useRef } from "react";
import { RotateCcw } from "lucide-react";

interface TourCardData {
  hotel_name: string;
  hotel_stars: number;
  hotel_rating: number;
  resort: string;
  country: string;
  date_from: string;
  date_to: string;
  nights: number;
  price: number;
  meal_description: string;
  departure_city: string;
  flight_included: boolean;
  image_url: string;
}

interface Msg {
  role: "user" | "assistant";
  text: string;
  cards?: TourCardData[];
  delay: number;
}

const tv = (c: number) => `https://static.tourvisor.ru/hotel_pics/main400/${c}.jpg`;

const MESSAGES: Msg[] = [
  { role: "user", text: "Хочу в Турцию на море", delay: 0 },
  { role: "assistant", text: "Отличный выбор! Из какого города планируете вылет?", delay: 1 },
  { role: "user", text: "Из Москвы", delay: 2 },
  { role: "assistant", text: "Когда хотите поехать и на сколько ночей?", delay: 3 },
  { role: "user", text: "В начале июня на неделю", delay: 4.2 },
  { role: "assistant", text: "Сколько гостей? Есть ли дети?", delay: 5.2 },
  { role: "user", text: "Вдвоём с женой", delay: 6.2 },
  { role: "assistant", text: "Какую категорию отеля и тип питания предпочитаете?", delay: 7.2 },
  { role: "user", text: "4-5 звёзд, всё включено", delay: 8.5 },
  { role: "assistant", text: "Нашёл отличные варианты для вас! Какой заинтересовал?", delay: 10, cards: [
    { hotel_name: "Barut Hemera", hotel_stars: 5, hotel_rating: 4.7, resort: "Сиде", country: "Турция", date_from: "03.06", date_to: "10.06", nights: 7, price: 142500, meal_description: "Всё включено", departure_city: "Москва", flight_included: true, image_url: tv(1033) },
    { hotel_name: "Calista Luxury Resort", hotel_stars: 5, hotel_rating: 4.8, resort: "Белек", country: "Турция", date_from: "02.06", date_to: "09.06", nights: 7, price: 186200, meal_description: "Ультра всё включено", departure_city: "Москва", flight_included: true, image_url: tv(1065) },
    { hotel_name: "Voyage Belek", hotel_stars: 5, hotel_rating: 4.6, resort: "Белек", country: "Турция", date_from: "04.06", date_to: "11.06", nights: 7, price: 158900, meal_description: "Ультра всё включено", departure_city: "Москва", flight_included: true, image_url: tv(1582) },
  ]},
  { role: "user", text: "Расскажи подробнее о первом", delay: 13 },
  { role: "assistant", text: "Barut Hemera 5★ — рейтинг 4.7\n\n📍 Сиде, первая линия, 50 м до моря\n🏖 Песчаный пляж, шезлонги бесплатно\n🏊 3 бассейна + крытый + аквапарк\n🍽 5 ресторанов, 4 бара\n👶 Детский клуб, анимация\n\nХотите узнать о перелёте или что входит в тур?", delay: 14.5 },
  { role: "user", text: "А что входит в стоимость?", delay: 16 },
  { role: "assistant", text: "В стоимость тура включено:\n\n✈️ Перелёт Москва — Анталья — Москва\n🚗 Групповой трансфер\n🏨 Проживание 7 ночей\n🍽 Питание All Inclusive\n🏥 Медицинская страховка\n\nХотите оформить или сравнить с другим?", delay: 17.5 },
];

const msgVariant = {
  hidden: { opacity: 0, y: 8, scale: 0.97 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.3 } },
};

function BotAvatar() {
  return (
    <div className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center" style={{ background: "linear-gradient(135deg, #0062EF, #0097F5)" }}>
      <svg viewBox="0 0 24 24" fill="white" className="w-3.5 h-3.5">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
      </svg>
    </div>
  );
}

function UserAvatar() {
  return (
    <div className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center" style={{ background: "linear-gradient(135deg, #1976D2, #1565C0)" }}>
      <svg viewBox="0 0 24 24" fill="white" className="w-3.5 h-3.5">
        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
      </svg>
    </div>
  );
}

function TourCard({ card }: { card: TourCardData }) {
  const stars = "★".repeat(card.hotel_stars);
  return (
    <div className="shrink-0 w-[220px] rounded-xl overflow-hidden border border-[#E0E0E0]/60 bg-white shadow-sm transition-transform hover:-translate-y-0.5 hover:shadow-md">
      <div className="relative h-[130px] bg-[#f0f0f0] overflow-hidden">
        <img src={card.image_url} alt={card.hotel_name} className="w-full h-full object-cover transition-transform duration-300 hover:scale-105" loading="lazy"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
        <div className="absolute top-2 left-2 rounded px-2 py-1 text-[11px] font-semibold backdrop-blur-md"
          style={{ background: "rgba(0,0,0,0.7)", color: "#FFD700", letterSpacing: "0.5px" }}>{stars}</div>
        <div className="absolute top-2 right-2 flex items-center gap-0.5 rounded px-1.5 py-1 text-[10px] font-bold text-white"
          style={{ background: "rgba(39,174,96,0.95)" }}>
          <span style={{ color: "#FFD700", fontSize: "9px" }}>★</span> {card.hotel_rating}
        </div>
      </div>
      <div className="p-2.5">
        <div className="text-[13px] font-bold text-[#2C3E50] truncate mb-1">{card.hotel_name}</div>
        <div className="text-[11px] text-[#7F8C8D] mb-1.5">📍 {card.country}, {card.resort}</div>
        <div className="space-y-1 mb-2">
          {card.flight_included && (
            <div className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[11px] font-medium text-[#27AE60]"
              style={{ background: "rgba(39,174,96,0.1)" }}>
              ✈️ {card.departure_city}
            </div>
          )}
          <div className="flex flex-wrap gap-x-3 text-[11px] text-[#2C3E50]">
            <span>📅 {card.date_from} — {card.date_to}</span>
            <span>🌙 {card.nights} ноч.</span>
          </div>
          <div className="text-[11px] text-[#2C3E50]">🍽️ {card.meal_description}</div>
        </div>
        <div className="mb-2.5">
          <div className="text-[17px] font-extrabold" style={{ color: "#0062EF" }}>
            {card.price.toLocaleString("ru-RU")} ₽
          </div>
          <div className="text-[10px] text-[#7F8C8D]">за тур</div>
        </div>
        <button className="flex w-full items-center justify-center gap-1 rounded-lg py-2 text-[12px] font-semibold text-white transition-all hover:-translate-y-px hover:shadow-md"
          style={{ background: "linear-gradient(135deg, #0062EF, #0097F5)", boxShadow: "0 2px 8px rgba(0,98,239,0.25)" }}>
          ✈️ Оформить тур
        </button>
      </div>
    </div>
  );
}

export default function HeroChatWidget({ className = "" }: { className?: string }) {
  const [visibleCount, setVisibleCount] = useState(0);
  const [showTyping, setShowTyping] = useState(false);
  const [playKey, setPlayKey] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const isFinished = visibleCount >= MESSAGES.length;

  useEffect(() => {
    if (visibleCount >= MESSAGES.length) return;
    const next = MESSAGES[visibleCount];
    const prev = visibleCount > 0 ? MESSAGES[visibleCount - 1].delay : 0;
    const base = (next.delay - prev) * 1000;
    const wait = visibleCount === 0 ? 600 : Math.max(base, 600);

    if (next.role === "assistant") {
      setShowTyping(true);
      const t = setTimeout(() => { setShowTyping(false); setVisibleCount((c) => c + 1); }, Math.max(wait, 800));
      return () => clearTimeout(t);
    } else {
      const t = setTimeout(() => setVisibleCount((c) => c + 1), Math.max(wait, 400));
      return () => clearTimeout(t);
    }
  }, [visibleCount, playKey]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [visibleCount, showTyping]);

  const replay = () => {
    setVisibleCount(0);
    setShowTyping(false);
    setPlayKey((k) => k + 1);
  };

  return (
    <div className={`flex flex-col rounded-2xl overflow-hidden border border-[#E0E0E0]/50 bg-white shadow-xl h-[600px] ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2.5 shrink-0"
        style={{ background: "linear-gradient(135deg, #0062EF, #0097F5, #00CCF5)" }}>
        <BotAvatar />
        <div className="flex-1">
          <div className="text-white font-semibold text-xs">AI Tour Assistant</div>
          <div className="flex items-center gap-1.5 text-white/70 text-[10px]">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
            Онлайн
          </div>
        </div>
        <span className="rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-medium text-white/80">
          Подбор тура
        </span>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden p-3 space-y-2.5" key={playKey}>
        <AnimatePresence mode="popLayout">
          {MESSAGES.slice(0, visibleCount).map((msg, i) => (
            <motion.div key={`${playKey}-${i}`} variants={msgVariant} initial="hidden" animate="visible"
              className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
              {msg.role === "user" ? <UserAvatar /> : <BotAvatar />}
              <div className={`flex max-w-[80%] flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
                <div className={`rounded-2xl px-3 py-2 text-xs leading-relaxed whitespace-pre-line ${
                  msg.role === "user"
                    ? "rounded-br-md text-white" : "rounded-bl-md bg-[#F8F9FA] text-[#2C3E50] shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
                }`} style={msg.role === "user" ? { background: "linear-gradient(135deg, #1976D2, #1565C0)" } : {}}>
                  {msg.text}
                </div>
                {msg.cards && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="mt-2 w-full">
                    <div className="flex gap-2 overflow-x-auto pb-1.5"
                      onWheel={(e) => { const el = e.currentTarget; if (Math.abs(e.deltaX) < Math.abs(e.deltaY)) el.scrollLeft += e.deltaY; }}>
                      {msg.cards.map((card, ci) => <TourCard key={ci} card={card} />)}
                    </div>
                    <div className="flex items-center justify-between text-[9px] text-[#95A5A6] px-1 mt-0.5">
                      <span>Найдено {msg.cards.length} тура</span>
                      <span>← листайте →</span>
                    </div>
                  </motion.div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {showTyping && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2">
            <BotAvatar />
            <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md bg-[#F8F9FA] px-4 py-3">
              {[0, 1, 2].map((i) => (
                <motion.span key={i} className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: "#0097F5" }}
                  animate={{ opacity: [0.3, 1, 0.3], scale: [0.85, 1, 0.85] }}
                  transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }} />
              ))}
            </div>
          </motion.div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-[#E0E0E0]/40 bg-white px-3 py-2.5 shrink-0">
        {isFinished ? (
          <button onClick={replay}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#F8F9FA] py-2 text-xs font-medium text-brand hover:bg-brand/5 transition-colors">
            <RotateCcw className="w-3.5 h-3.5" /> Воспроизвести снова
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <div className="flex-1 rounded-xl border border-[#E0E0E0] bg-white px-3 py-2 text-xs text-[#95A5A6]">
              Напишите сообщение...
            </div>
            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white shrink-0"
              style={{ background: "linear-gradient(135deg, #0062EF, #0097F5)" }}>
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" /></svg>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
