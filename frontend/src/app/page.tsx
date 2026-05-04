"use client";

import { useState, useCallback } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { MobileNav } from "@/components/layout/MobileNav";
import { WelcomeScreen } from "@/components/chat/WelcomeScreen";
import { MessageList } from "@/components/chat/MessageList";
import { InputBar, type QuickAction } from "@/components/chat/InputBar";
import { ClientProfileChip } from "@/components/chat/ClientProfileChip";
import { HotelDetailPanel } from "@/components/detail/HotelDetailPanel";
import { PhotoGallery } from "@/components/detail/PhotoGallery";
import { HotelMap } from "@/components/map/HotelMap";
import { FavoritesView } from "@/components/favorites/FavoritesView";
import { CountryMemosView } from "@/components/memos/CountryMemosView";
import { AboutView } from "@/components/about/AboutView";
import { PartnersView } from "@/components/partners/PartnersView";
import { useChat } from "@/hooks/useChat";
import { useFavorites } from "@/hooks/useFavorites";
import { TourCard, FlightOption } from "@/lib/types";
import { AnimatePresence, motion } from "framer-motion";
import { X, Map } from "lucide-react";

const QUICK_ACTIONS_WITH_RESULTS: QuickAction[] = [
  {
    label: "Лучший для клиента",
    prompt:
      "Из текущей выдачи выбери лучший вариант под профиль моего клиента. Дай 1 альтернативу и 1, который не рекомендую — кратко по фактам.",
  },
  {
    label: "ТОП-3 для подборки",
    prompt:
      "Собери из текущей выдачи 3 варианта: бюджетный, оптимальный, апсейл. Кратко поясни каждый, без аббревиатур.",
  },
  {
    label: "Сравни 1 и 2",
    prompt:
      "Сравни первый и второй отель из текущей выдачи: пляж, питание, рейтинг, цена. Кому какой подойдёт.",
  },
  {
    label: "Возражение «дорого»",
    prompt:
      "Клиент говорит «дорого». Дай 2-3 короткие фразы и предложи альтернативу из текущей выдачи.",
  },
  {
    label: "Альтернатива в этой цене",
    prompt:
      "Покажи 2 альтернативы в том же бюджете из текущей выдачи и поясни отличия одной строкой.",
  },
  {
    label: "Что входит в первый",
    prompt:
      "Что входит в цену первого тура из выдачи: рейсы, багаж, доплаты, что не включено.",
  },
];

const QUICK_ACTIONS_WITHOUT_RESULTS: QuickAction[] = [
  {
    label: "ТЗ из переписки",
    prompt:
      "Вот переписка с клиентом — собери короткое ТЗ по шаблону: клиент / направление / даты / важно / бюджет. Не запускай поиск, только выжимка.",
  },
  {
    label: "Горящие туры",
    prompt: "Покажи горящие туры из Москвы — что есть прямо сейчас.",
  },
  {
    label: "Подборка недели",
    prompt:
      "Собери «Подборку недели» для соцсетей агентства: 5–6 интересных туров из текущих горящих предложений, разные страны и ценовые сегменты. Сразу сформируй её в чате как finальную (через build_collection с подходящим title), чтобы я мог взять share-ссылку и отправить клиентам/опубликовать.",
  },
];

export default function Home() {
  const {
    messages,
    isLoading,
    sessions,
    activeSessionId,
    send,
    newChat,
    selectSession,
    appendLocal,
    clientProfile,
    clearClientProfile,
    updateClientProfile,
  } = useChat();

  const { toggleFavorite, isFavorited, favoritedIds } = useFavorites();

  const [view, setView] = useState<"chat" | "favorites" | "memos" | "about" | "partners">("chat");
  const [selectedCard, setSelectedCard] = useState<TourCard | null>(null);
  const [galleryImages, setGalleryImages] = useState<string[] | null>(null);
  const [galleryStart, setGalleryStart] = useState(0);
  const [mapCards, setMapCards] = useState<TourCard[] | null>(null);
  const hasMessages = messages.length > 0;
  const hasReceivedCards = messages.some((m) => m.tour_cards && m.tour_cards.length > 0);
  const quickActions = hasReceivedCards
    ? QUICK_ACTIONS_WITH_RESULTS
    : QUICK_ACTIONS_WITHOUT_RESULTS;

  const openGallery = useCallback((images: string[], startIndex: number) => {
    setGalleryImages(images);
    setGalleryStart(startIndex);
  }, []);

  const closeGallery = useCallback(() => {
    setGalleryImages(null);
  }, []);

  const openMap = useCallback((cards: TourCard[]) => {
    setMapCards(cards);
  }, []);

  const closeMap = useCallback(() => {
    setMapCards(null);
  }, []);

  const handleLogoClick = useCallback(() => {
    setView("chat");
    setSelectedCard(null);
  }, []);

  const handleFavoritesClick = useCallback(() => {
    setView("favorites");
    setSelectedCard(null);
  }, []);

  const handleMemosClick = useCallback(() => {
    setView("memos");
    setSelectedCard(null);
  }, []);

  const handleAboutClick = useCallback(() => {
    setView("about");
    setSelectedCard(null);
  }, []);

  const handlePartnersClick = useCallback(() => {
    setView("partners");
    setSelectedCard(null);
  }, []);

  const handleNewChat = useCallback(() => {
    setView("chat");
    setSelectedCard(null);
    newChat();
  }, [newChat]);

  const handleSelectSession = useCallback((id: string) => {
    setView("chat");
    setSelectedCard(null);
    selectSession(id);
  }, [selectSession]);

  /** Зафиксировать выбранный рейс для тура — повтор UX из reference-репозитория.
   *  Локально (без LLM) добавляет в чат пару:
   *  - user: «Зафиксирую конфигурацию: …»
   *  - assistant: подтверждение + одна обновлённая карточка с selected_flight,
   *    flight_summary, новой ценой и сохранённой исходной карточкой как базы.
   */
  const handleSelectFlight = useCallback(
    (sourceCard: TourCard, option: FlightOption) => {
      const fwd = option.forward[0];
      const bwd = option.backward[0];
      const airline = fwd?.airline || "авиакомпания";
      const fwdSummary = fwd
        ? `${fwd.departure_airport_code || fwd.departure_airport}→${
            fwd.arrival_airport_code || fwd.arrival_airport
          } ${fwd.departure_time}–${fwd.arrival_time}`
        : "перелёт туда";
      const bwdSummary = bwd
        ? `${bwd.departure_airport_code || bwd.departure_airport}→${
            bwd.arrival_airport_code || bwd.arrival_airport
          } ${bwd.departure_time}–${bwd.arrival_time}`
        : "перелёт обратно";
      const newPrice = option.price || sourceCard.price;
      const flightSummary = `${airline} · ${fwdSummary} / ${bwdSummary}`;
      const fallbackDeparture =
        sourceCard.departure_city ||
        fwd?.departure_airport ||
        fwd?.departure_airport_code ||
        "";

      const updatedCard: TourCard = {
        ...sourceCard,
        // Сохраняем тот же tour_id, чтобы favourites/share не потеряли карточку.
        // Под капотом уточняется только перелёт.
        price: newPrice,
        date_from: option.date_forward || sourceCard.date_from,
        date_to: option.date_backward || sourceCard.date_to,
        departure_city: fallbackDeparture,
        selected_flight: option,
        flight_summary: flightSummary,
      };

      const baggageNote = fwd?.baggage
        ? `Багаж: ${fwd.baggage}.`
        : "Багаж: уточняется у оператора.";
      const carryNote = fwd?.carry_on ? ` Ручная кладь: ${fwd.carry_on}.` : "";
      const fuelNote =
        option.fuel_charge && option.fuel_charge > 0
          ? ` Топливный сбор: ${option.fuel_charge.toLocaleString("ru-RU")} ₽.`
          : "";
      const onDemandNote =
        fwd?.on_demand || bwd?.on_demand
          ? " Часть рейса под запрос — нужно подтверждение оператора."
          : "";

      const userMsg = `Зафиксирую конфигурацию: ${sourceCard.hotel_name} — рейс ${airline} (${fwdSummary}).`;
      const assistantMsg =
        `Зафиксировал: ${sourceCard.hotel_name} (${sourceCard.hotel_stars}★, ${sourceCard.country}, ${sourceCard.resort}). ` +
        `Перелёт: ${airline}, ${fwdSummary} → ${bwdSummary}. ` +
        `Цена с этим рейсом: ${newPrice.toLocaleString("ru-RU")} ₽ за ${sourceCard.nights} ночей. ` +
        `${baggageNote}${carryNote}${fuelNote}${onDemandNote} ` +
        `Дальше: проверить актуальность цены, сформировать сообщение клиенту или подобрать альтернативу.`;

      appendLocal(userMsg, assistantMsg, [updatedCard]);
    },
    [appendLocal]
  );

  /** Финальная подборка из выбранных карточек: добавляем в чат пару
   *  сообщений + те же карточки. Под bubble автоматически появится
   *  кнопка «Поделиться подборкой» (берёт `message.tour_cards`). */
  const handleCollectFinal = useCallback(
    (selected: TourCard[]) => {
      if (!selected.length) return;
      const names = selected.map((c) => c.hotel_name).filter(Boolean);
      const namesLine =
        names.length <= 4
          ? names.join(", ")
          : `${names.slice(0, 3).join(", ")} и ещё ${names.length - 3}`;
      const totalMin = Math.min(...selected.map((c) => c.price || 0).filter((p) => p > 0));
      const totalMax = Math.max(...selected.map((c) => c.price || 0).filter((p) => p > 0));
      const priceLine =
        Number.isFinite(totalMin) && Number.isFinite(totalMax) && totalMin > 0
          ? totalMin === totalMax
            ? `Цена: от ${totalMin.toLocaleString("ru-RU")} ₽.`
            : `Цена: от ${totalMin.toLocaleString("ru-RU")} ₽ до ${totalMax.toLocaleString("ru-RU")} ₽.`
          : "";
      const userMsg = `Собираю финальную подборку из ${selected.length} ${
        selected.length === 1 ? "тура" : selected.length < 5 ? "туров" : "туров"
      }: ${namesLine}.`;
      const assistantMsg = [
        `Готово — финальная подборка из ${selected.length} ${
          selected.length === 1 ? "варианта" : "вариантов"
        } для клиента.`,
        priceLine,
        "Можно поделиться публичной HTML-страницей через кнопку под этим сообщением — она открывается без логина и без следов TourVisor.",
      ]
        .filter(Boolean)
        .join(" ");
      appendLocal(userMsg, assistantMsg, selected);
    },
    [appendLocal]
  );

  return (
    <div className="flex h-screen h-[100dvh] overflow-hidden bg-background">
      {/* Desktop Sidebar */}
      <div className="hidden md:block">
        <Sidebar
          sessions={sessions}
          activeSessionId={activeSessionId}
          onNewChat={handleNewChat}
          onSelectSession={handleSelectSession}
          onFavoritesClick={handleFavoritesClick}
          onMemosClick={handleMemosClick}
          onAboutClick={handleAboutClick}
          onPartnersClick={handlePartnersClick}
          onLogoClick={handleLogoClick}
          isFavoritesActive={view === "favorites"}
          isMemosActive={view === "memos"}
          isAboutActive={view === "about"}
          isPartnersActive={view === "partners"}
        />
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Header */}
        <MobileNav
          sessions={sessions}
          activeSessionId={activeSessionId}
          onNewChat={handleNewChat}
          onSelectSession={handleSelectSession}
          onFavoritesClick={handleFavoritesClick}
          onMemosClick={handleMemosClick}
          onAboutClick={handleAboutClick}
          onPartnersClick={handlePartnersClick}
          onLogoClick={handleLogoClick}
          isFavoritesActive={view === "favorites"}
          isMemosActive={view === "memos"}
          isAboutActive={view === "about"}
          isPartnersActive={view === "partners"}
        />

        {/* Main Content */}
        <div className="flex-1 flex min-h-0">
          <div className={`flex flex-col min-w-0 ${selectedCard ? "lg:w-1/2" : "flex-1"} transition-[flex,width] duration-200 ease-out`}>
            {view === "partners" ? (
              <PartnersView />
            ) : view === "about" ? (
              <AboutView />
            ) : view === "memos" ? (
              <CountryMemosView />
            ) : view === "favorites" ? (
              <FavoritesView
                onCardDetails={setSelectedCard}
                onCardFavorite={toggleFavorite}
                favoritedIds={favoritedIds}
              />
            ) : hasMessages ? (
              <>
                <MessageList
                  messages={messages}
                  isLoading={isLoading}
                  onCardDetails={setSelectedCard}
                  onCardFavorite={toggleFavorite}
                  favoritedIds={favoritedIds}
                  onShowMap={openMap}
                  onCollectFinal={handleCollectFinal}
                />
                <ClientProfileChip
                  profile={clientProfile}
                  onClear={clearClientProfile}
                  onUpdate={updateClientProfile}
                />
                <InputBar
                  onSend={send}
                  isLoading={isLoading}
                  placeholder="Опиши запрос клиента, попроси сравнение или подборку…"
                  quickActions={quickActions}
                />
              </>
            ) : (
              <WelcomeScreen onSend={send} isLoading={isLoading} />
            )}
          </div>

          {/* Detail Panel (desktop) — 50% width */}
          <AnimatePresence>
            {selectedCard && (
              <motion.div
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 30 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="hidden lg:block w-1/2 h-full"
              >
                <HotelDetailPanel
                  card={selectedCard}
                  onClose={() => setSelectedCard(null)}
                  onFavorite={toggleFavorite}
                  isFavorited={isFavorited(selectedCard.tour_id)}
                  onOpenGallery={openGallery}
                  onSelectFlight={handleSelectFlight}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Detail Panel (mobile - bottom sheet) */}
          <AnimatePresence>
            {selectedCard && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="lg:hidden fixed inset-0 z-40"
              >
                <div
                  className="absolute inset-0 bg-black/40"
                  onClick={() => setSelectedCard(null)}
                />
                <motion.div
                  initial={{ y: "100%" }}
                  animate={{ y: 0 }}
                  exit={{ y: "100%" }}
                  transition={{ type: "spring", damping: 30, stiffness: 350 }}
                  className="absolute bottom-0 left-0 right-0 h-[85dvh] bg-background rounded-t-2xl overflow-hidden"
                >
                  <div className="flex justify-center pt-2 pb-1">
                    <div className="w-8 h-1 rounded-full bg-muted-foreground/30" />
                  </div>
                  <HotelDetailPanel
                    card={selectedCard}
                    onClose={() => setSelectedCard(null)}
                    onFavorite={toggleFavorite}
                    isFavorited={isFavorited(selectedCard.tour_id)}
                    onOpenGallery={openGallery}
                    onSelectFlight={handleSelectFlight}
                  />
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Photo Gallery Modal */}
      <AnimatePresence>
        {galleryImages && galleryImages.length > 0 && (
          <PhotoGallery
            images={galleryImages}
            startIndex={galleryStart}
            onClose={closeGallery}
          />
        )}
      </AnimatePresence>

      {/* Map Modal */}
      <AnimatePresence>
        {mapCards && mapCards.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center"
          >
            <div className="absolute inset-0 bg-black/50" onClick={closeMap} />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative w-[90vw] h-[80dvh] max-w-5xl bg-background rounded-2xl overflow-hidden shadow-2xl"
            >
              <div className="flex items-center justify-between px-5 py-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <Map className="h-4 w-4 text-brand" />
                  <h3 className="text-sm font-semibold">Отели на карте</h3>
                  <span className="text-xs text-muted-foreground">{mapCards.length} вариантов</span>
                </div>
                <button onClick={closeMap} className="p-2 hover:bg-muted rounded-lg transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <HotelMap
                cards={mapCards}
                onSelectCard={(card) => { setSelectedCard(card); closeMap(); }}
                className="w-full h-[calc(100%-52px)]"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
