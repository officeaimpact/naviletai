"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState, useRef } from "react";
import { RotateCcw, Globe, Flame, Building2, Car, HelpCircle, Phone } from "lucide-react";

/* ─── Types ─── */

interface DemoTourCard {
  hotel_name: string;
  hotel_stars: number;
  hotel_rating: number;
  resort: string;
  country: string;
  date_from: string;
  date_to: string;
  nights: number;
  price: number;
  price_per_person?: number;
  meal_description: string;
  room_type: string;
  departure_city: string;
  flight_included: boolean;
  discount?: number;
  image_url: string;
}

interface DemoMessage {
  role: "user" | "assistant";
  text: string;
  cards?: DemoTourCard[];
  delay: number;
}

export interface DemoScenario {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  messages: DemoMessage[];
}

const tv = (code: number) => `https://static.tourvisor.ru/hotel_pics/main400/${code}.jpg`;

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Globe, Flame, Building2, Car, HelpCircle, Phone,
};

const msgVariant = {
  hidden: { opacity: 0, y: 8, scale: 0.97 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.3, ease: "easeOut" } },
};

/* ─── Scenarios ─── */

export const demoScenarios: DemoScenario[] = [
  {
    id: "regular", title: "Подбор тура", subtitle: "Полный каскадный диалог", icon: "Globe",
    messages: [
      { role: "user", text: "Хочу в Турцию на море", delay: 0 },
      { role: "assistant", text: "Отличный выбор! Из какого города планируете вылет?", delay: 1 },
      { role: "user", text: "Из Москвы", delay: 2 },
      { role: "assistant", text: "Когда хотите поехать и на сколько ночей?", delay: 3 },
      { role: "user", text: "В начале июня на неделю", delay: 4.2 },
      { role: "assistant", text: "Сколько гостей? Есть ли дети?", delay: 5.2 },
      { role: "user", text: "Вдвоём с женой", delay: 6.2 },
      { role: "assistant", text: "Какую категорию отеля и тип питания предпочитаете?", delay: 7.2 },
      { role: "user", text: "4-5 звёзд, всё включено", delay: 8.5 },
      { role: "assistant", text: "Нашёл отличные варианты для вас!", delay: 10, cards: [
        { hotel_name: "Barut Hemera", hotel_stars: 5, hotel_rating: 4.7, resort: "Сиде", country: "Турция", date_from: "03.06", date_to: "10.06", nights: 7, price: 142500, meal_description: "Всё включено", room_type: "Standard", departure_city: "Москва", flight_included: true, image_url: tv(1033) },
        { hotel_name: "Calista Luxury Resort", hotel_stars: 5, hotel_rating: 4.8, resort: "Белек", country: "Турция", date_from: "02.06", date_to: "09.06", nights: 7, price: 186200, meal_description: "Ультра всё включено", room_type: "Deluxe", departure_city: "Москва", flight_included: true, image_url: tv(1065) },
        { hotel_name: "Voyage Belek", hotel_stars: 5, hotel_rating: 4.6, resort: "Белек", country: "Турция", date_from: "04.06", date_to: "11.06", nights: 7, price: 158900, meal_description: "Ультра всё включено", room_type: "Standard", departure_city: "Москва", flight_included: true, image_url: tv(1582) },
      ]},
    ],
  },
  {
    id: "hot", title: "Горящие туры", subtitle: "Скидки до 40%", icon: "Flame",
    messages: [
      { role: "user", text: "Есть горящие путёвки?", delay: 0 },
      { role: "assistant", text: "Конечно! Из какого города вылет?", delay: 1 },
      { role: "user", text: "Из Москвы", delay: 2 },
      { role: "assistant", text: "Вот горящие предложения! Цены за человека.", delay: 3.5, cards: [
        { hotel_name: "Side Moon Palace", hotel_stars: 5, hotel_rating: 4.2, resort: "Сиде", country: "Турция", date_from: "13.03", date_to: "19.03", nights: 6, price: 98880, price_per_person: 49440, meal_description: "Ультра всё включено", room_type: "Standard", departure_city: "Москва", flight_included: true, discount: 9, image_url: tv(111129) },
        { hotel_name: "Amarina Queen Resort", hotel_stars: 5, hotel_rating: 4.7, resort: "Марса Алам", country: "Египет", date_from: "06.03", date_to: "12.03", nights: 6, price: 88242, price_per_person: 44121, meal_description: "Всё включено", room_type: "Standard", departure_city: "Москва", flight_included: true, discount: 33, image_url: tv(36302) },
        { hotel_name: "Adalya Elite Lara", hotel_stars: 5, hotel_rating: 4.5, resort: "Лара", country: "Турция", date_from: "15.03", date_to: "22.03", nights: 7, price: 112600, price_per_person: 56300, meal_description: "Ультра всё включено", room_type: "Deluxe", departure_city: "Москва", flight_included: true, discount: 18, image_url: tv(47025) },
      ]},
      { role: "user", text: "Какой пляж у второго?", delay: 6.5 },
      { role: "assistant", text: "Amarina Queen — собственный коралловый риф, песчаный пляж, пологий вход. Первая линия, 80 м до моря. Отлично для снорклинга!", delay: 8 },
    ],
  },
  {
    id: "hotel", title: "Конкретный отель", subtitle: "Поиск по названию", icon: "Building2",
    messages: [
      { role: "user", text: "Хочу в Rixos в Турцию", delay: 0 },
      { role: "assistant", text: "Rixos — отличная сеть! Из какого города вылет?", delay: 1 },
      { role: "user", text: "Из Москвы, середина июля, вдвоём, всё включено", delay: 2.5 },
      { role: "assistant", text: "Нашёл предложения по отелям Rixos:", delay: 4, cards: [
        { hotel_name: "Rixos Premium Belek", hotel_stars: 5, hotel_rating: 4.8, resort: "Белек", country: "Турция", date_from: "14.07", date_to: "21.07", nights: 7, price: 245800, meal_description: "Ультра всё включено", room_type: "Superior", departure_city: "Москва", flight_included: true, image_url: tv(1449) },
        { hotel_name: "Rixos Sungate", hotel_stars: 5, hotel_rating: 4.6, resort: "Кемер", country: "Турция", date_from: "15.07", date_to: "22.07", nights: 7, price: 198500, meal_description: "Ультра всё включено", room_type: "Standard", departure_city: "Москва", flight_included: true, image_url: tv(1452) },
        { hotel_name: "Rixos Downtown Antalya", hotel_stars: 5, hotel_rating: 4.5, resort: "Анталья", country: "Турция", date_from: "13.07", date_to: "20.07", nights: 7, price: 142000, meal_description: "Всё включено", room_type: "Deluxe", departure_city: "Москва", flight_included: true, image_url: tv(1494) },
      ]},
      { role: "user", text: "Какой перелёт в первом?", delay: 7 },
      { role: "assistant", text: "✈️ Туда: Москва (VKO) → Анталья\nAzur Air, 14.07 в 08:45, прилёт 12:20\nПрямой, 3ч 35м\n\n✈️ Обратно: 21.07 в 13:10, прилёт 18:40", delay: 8.5 },
    ],
  },
  {
    id: "noflight", title: "Без перелёта", subtitle: "На машине или автобусе", icon: "Car",
    messages: [
      { role: "user", text: "Хотим в Сочи на машине", delay: 0 },
      { role: "assistant", text: "Тур без перелёта! Когда и на сколько ночей?", delay: 1 },
      { role: "user", text: "Начало июля, 10 ночей, 2 взрослых + ребёнок 5 лет", delay: 2.5 },
      { role: "assistant", text: "Нашёл варианты в Сочи:", delay: 4, cards: [
        { hotel_name: "Radisson Paradise", hotel_stars: 5, hotel_rating: 4.6, resort: "Адлер", country: "Россия", date_from: "01.07", date_to: "11.07", nights: 10, price: 98400, meal_description: "Завтрак", room_type: "Standard", departure_city: "—", flight_included: false, image_url: tv(4832) },
        { hotel_name: "Hyatt Regency Sochi", hotel_stars: 5, hotel_rating: 4.5, resort: "Центр. Сочи", country: "Россия", date_from: "01.07", date_to: "11.07", nights: 10, price: 112600, meal_description: "Завтрак", room_type: "Standard", departure_city: "—", flight_included: false, image_url: tv(63929) },
        { hotel_name: "Бридж Резорт", hotel_stars: 4, hotel_rating: 4.3, resort: "Адлер", country: "Россия", date_from: "01.07", date_to: "11.07", nights: 10, price: 62800, meal_description: "Завтрак", room_type: "Standard", departure_city: "—", flight_included: false, image_url: tv(29042) },
      ]},
      { role: "user", text: "Далеко ли первый от моря?", delay: 7 },
      { role: "assistant", text: "Radisson Paradise — первая линия, 150 м до моря. Собственный галечный пляж, шезлонги бесплатно. Территория 10 га.", delay: 8.5 },
    ],
  },
  {
    id: "faq", title: "Частые вопросы", subtitle: "Визы, питание, документы", icon: "HelpCircle",
    messages: [
      { role: "user", text: "Нужна ли виза в Турцию?", delay: 0 },
      { role: "assistant", text: "Для граждан РФ виза не нужна — до 60 дней. Загранпаспорт действителен 120+ дней после въезда.", delay: 1.2 },
      { role: "user", text: "Что входит в стоимость тура?", delay: 2.5 },
      { role: "assistant", text: "✅ Перелёт туда-обратно\n✅ Трансфер\n✅ Проживание\n✅ Питание по типу\n✅ Страховка\n\n❌ Виза, экскурсии, инд. трансфер", delay: 4 },
      { role: "user", text: "Какое питание лучше с детьми?", delay: 5.5 },
      { role: "assistant", text: "С детьми рекомендую All Inclusive:\n🍽 3 приёма + снэки + напитки весь день\n🍽 Детское меню в отелях 4-5★\n\nВ 5★ обычно лучшая детская инфраструктура.", delay: 7 },
    ],
  },
  {
    id: "sos", title: "Связь с менеджером", subtitle: "Бронирование, помощь", icon: "Phone",
    messages: [
      { role: "user", text: "Хочу поменять даты в бронировании", delay: 0 },
      { role: "assistant", text: "Для изменения дат обратитесь к менеджеру:\n\n📞 +7 (800) 555-35-35\n⏰ Ежедневно 9:00–21:00\n\nМенеджер проверит возможность и рассчитает доплату.", delay: 1.2 },
      { role: "user", text: "А можно отменить тур?", delay: 3 },
      { role: "assistant", text: "Условия зависят от сроков:\n• >30 дн — возврат большей части\n• 15–30 дн — частичное удержание\n• <15 дн — штрафные санкции\n\n📞 +7 (800) 555-35-35", delay: 4.5 },
    ],
  },
];

/* ─── Sub-components ─── */

function BotAvatar() {
  return (
    <div className="shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
      <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
      </svg>
    </div>
  );
}

function UserAvatar() {
  return (
    <div className="shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
      <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
      </svg>
    </div>
  );
}

function TypingDots() {
  return (
    <div className="flex items-end gap-2">
      <BotAvatar />
      <div className="bg-[#1e293b] rounded-2xl rounded-bl-md px-4 py-3 flex gap-1">
        {[0, 1, 2].map((i) => (
          <span key={i} className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
        ))}
      </div>
    </div>
  );
}

function TourCard({ card }: { card: DemoTourCard }) {
  const price = card.price_per_person
    ? `${card.price_per_person.toLocaleString("ru-RU")} ₽`
    : `${card.price.toLocaleString("ru-RU")} ₽`;
  const label = card.price_per_person ? "за чел." : card.flight_included ? "за тур" : "за прожив.";
  const stars = "★".repeat(card.hotel_stars);

  return (
    <div className="shrink-0 w-[240px] rounded-xl overflow-hidden bg-[#0f172a] border border-white/10">
      <div className="relative h-[120px] overflow-hidden bg-[#1e293b]">
        <img src={card.image_url} alt={card.hotel_name} className="w-full h-full object-cover"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} loading="lazy" />
        <span className="absolute top-2 left-2 bg-black/60 text-yellow-400 text-[9px] font-bold px-1.5 py-0.5 rounded">{stars}</span>
        <span className="absolute top-2 right-2 bg-blue-500/80 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">★ {card.hotel_rating}</span>
        {card.discount && <span className="absolute top-7 right-2 bg-red-500/90 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">-{card.discount}%</span>}
        {!card.flight_included && <span className="absolute bottom-2 left-2 bg-orange-500/80 text-white text-[8px] font-bold px-1.5 py-0.5 rounded">Без перелёта</span>}
      </div>
      <div className="p-2.5 space-y-1.5">
        <h4 className="text-white font-semibold text-xs truncate">{card.hotel_name}</h4>
        <p className="text-gray-400 text-[10px]">{card.country}, {card.resort}</p>
        <div className="text-gray-300 text-[10px] space-y-0.5">
          {card.flight_included && <div>✈️ {card.departure_city}</div>}
          <div>📅 {card.date_from}–{card.date_to} · {card.nights} ноч.</div>
          <div>🍽 {card.meal_description}</div>
        </div>
        <div className="pt-1 border-t border-white/10">
          <span className="text-blue-400 font-bold text-sm">{price}</span>
          <span className="text-gray-500 text-[9px] ml-1">{label}</span>
        </div>
      </div>
    </div>
  );
}

export function ScenarioButton({ scenario, isActive, onClick }: {
  scenario: DemoScenario; isActive: boolean; onClick: () => void;
}) {
  const Icon = iconMap[scenario.icon];
  return (
    <button onClick={onClick} className={`group w-full text-left rounded-xl border p-3 transition-all ${
      isActive ? "border-brand/50 bg-brand/5 shadow-sm" : "border-border/40 hover:border-border hover:bg-muted/30"
    }`}>
      <div className="flex items-start gap-2.5">
        <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
          isActive ? "bg-brand/15 text-brand" : "bg-muted text-muted-foreground group-hover:text-foreground"
        }`}>
          {Icon && <Icon className="w-4 h-4" />}
        </div>
        <div>
          <div className={`font-medium text-xs ${isActive ? "text-brand" : "text-foreground"}`}>{scenario.title}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">{scenario.subtitle}</div>
        </div>
      </div>
    </button>
  );
}

/* ─── Main Widget ─── */

interface DemoWidgetProps {
  scenario: DemoScenario | null;
  className?: string;
}

export default function DemoWidget({ scenario, className = "" }: DemoWidgetProps) {
  const [visibleCount, setVisibleCount] = useState(0);
  const [showTyping, setShowTyping] = useState(false);
  const [playKey, setPlayKey] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const messages = scenario?.messages ?? [];
  const isFinished = scenario && visibleCount >= messages.length;

  useEffect(() => {
    setVisibleCount(0);
    setShowTyping(false);
    setPlayKey((k) => k + 1);
  }, [scenario?.id]);

  useEffect(() => {
    if (!scenario || visibleCount >= messages.length) return;
    const next = messages[visibleCount];
    const prev = visibleCount > 0 ? messages[visibleCount - 1].delay : 0;
    const base = (next.delay - prev) * 1000;
    const wait = visibleCount === 0 ? 300 : Math.max(base, 600);

    if (next.role === "assistant") {
      setShowTyping(true);
      const t = setTimeout(() => { setShowTyping(false); setVisibleCount((c) => c + 1); }, Math.max(wait, 800));
      return () => clearTimeout(t);
    } else {
      const t = setTimeout(() => setVisibleCount((c) => c + 1), Math.max(wait, 400));
      return () => clearTimeout(t);
    }
  }, [visibleCount, scenario, messages, playKey]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [visibleCount, showTyping]);

  return (
    <div className={`flex flex-col rounded-2xl overflow-hidden border border-white/10 bg-[#0b1120] shadow-2xl h-[520px] ${className}`}>
      <div className="flex items-center gap-3 px-4 py-2.5 bg-gradient-to-r from-[#0f172a] to-[#1e293b] border-b border-white/10">
        <BotAvatar />
        <div className="flex-1 min-w-0">
          <div className="text-white font-semibold text-xs">AI Tour Assistant</div>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-emerald-400 text-[10px]">Онлайн</span>
          </div>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden p-3 space-y-2.5 scroll-smooth" key={playKey}>
        {!scenario && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center mb-3">
              <Globe className="w-7 h-7 text-blue-400" />
            </div>
            <h3 className="text-white font-semibold text-sm mb-1">Выберите сценарий</h3>
            <p className="text-gray-500 text-xs">Нажмите на один из сценариев справа</p>
          </div>
        )}

        <AnimatePresence mode="popLayout">
          {messages.slice(0, visibleCount).map((msg, i) => (
            <motion.div key={`${scenario?.id}-${i}`} variants={msgVariant} initial="hidden" animate="visible"
              className={`flex items-end gap-2 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
              {msg.role === "user" ? <UserAvatar /> : <BotAvatar />}
              <div className="max-w-[80%] space-y-2">
                <div className={`rounded-2xl px-3.5 py-2 text-xs leading-relaxed whitespace-pre-line ${
                  msg.role === "user"
                    ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-br-md"
                    : "bg-[#1e293b] text-gray-200 rounded-bl-md"
                }`}>{msg.text}</div>
                {msg.cards && (
                  <div className="space-y-1">
                    <div className="flex gap-2.5 overflow-x-auto pb-1.5 scrollbar-thin"
                      onWheel={(e) => { const el = e.currentTarget; if (Math.abs(e.deltaX) < Math.abs(e.deltaY)) el.scrollLeft += e.deltaY; }}>
                      {msg.cards.map((card, ci) => <TourCard key={ci} card={card} />)}
                    </div>
                    <div className="flex items-center justify-between text-[9px] text-gray-500 px-1">
                      <span>Найдено {msg.cards.length} тура</span>
                      <span>← листайте →</span>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {showTyping && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}><TypingDots /></motion.div>}
      </div>

      <div className="px-3 py-2.5 border-t border-white/10 bg-[#0f172a]">
        {isFinished ? (
          <button onClick={() => { setVisibleCount(0); setShowTyping(false); setPlayKey((k) => k + 1); }}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-white/5 border border-white/10 text-gray-400 text-xs hover:bg-white/10 hover:text-white transition-all">
            <RotateCcw className="w-3.5 h-3.5" /> Воспроизвести снова
          </button>
        ) : (
          <div className="flex items-center gap-2 py-1.5 px-3 rounded-xl bg-white/5 border border-white/10">
            <div className="flex-1 text-gray-600 text-xs">Напишите сообщение...</div>
            <div className="w-7 h-7 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-blue-400" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" /></svg>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
