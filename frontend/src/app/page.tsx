"use client";

import { useState, useCallback } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { MobileNav } from "@/components/layout/MobileNav";
import { WelcomeScreen } from "@/components/chat/WelcomeScreen";
import { MessageList } from "@/components/chat/MessageList";
import { InputBar, type QuickAction } from "@/components/chat/InputBar";
import { HotelDetailPanel } from "@/components/detail/HotelDetailPanel";
import { PhotoGallery } from "@/components/detail/PhotoGallery";
import { HotelMap } from "@/components/map/HotelMap";
import { FavoritesView } from "@/components/favorites/FavoritesView";
import { AboutView } from "@/components/about/AboutView";
import { PartnersView } from "@/components/partners/PartnersView";
import { useChat } from "@/hooks/useChat";
import { useFavorites } from "@/hooks/useFavorites";
import { TourCard } from "@/lib/types";
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
  } = useChat();

  const { toggleFavorite, isFavorited, favoritedIds } = useFavorites();

  const [view, setView] = useState<"chat" | "favorites" | "about" | "partners">("chat");
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
          onAboutClick={handleAboutClick}
          onPartnersClick={handlePartnersClick}
          onLogoClick={handleLogoClick}
          isFavoritesActive={view === "favorites"}
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
          onAboutClick={handleAboutClick}
          onPartnersClick={handlePartnersClick}
          onLogoClick={handleLogoClick}
          isFavoritesActive={view === "favorites"}
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
