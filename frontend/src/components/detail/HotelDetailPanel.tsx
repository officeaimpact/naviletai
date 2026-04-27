"use client";

import { useEffect, useState, useCallback } from "react";
import { TourCard, HotelInfo, FlightOption, FlightSegment } from "@/lib/types";
import { getHotelInfo, getTourFlights, fixImageUrl } from "@/lib/api";
import { formatPrice } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Heart, Share2, X, Star, ExternalLink, ChevronDown, ChevronUp,
  Waves, Baby, Bed, Utensils, Dumbbell, MapPin, Building2,
  Phone, Globe, Ruler, Calendar, Sparkles, Wifi, CreditCard,
  TreePalm, UtensilsCrossed, Music, Navigation, Plane,
  Luggage, Clock, ArrowRight, ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { HotelMap } from "@/components/map/HotelMap";

interface HotelDetailPanelProps {
  card: TourCard;
  onClose: () => void;
  onFavorite?: (card: TourCard) => void;
  isFavorited?: boolean;
  onOpenGallery?: (images: string[], startIndex: number) => void;
}

/* ───────── Small helpers ───────── */

function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse bg-muted rounded-lg", className)} />;
}

function calcDuration(depTime: string, arrTime: string, depDate: string, arrDate: string) {
  if (!depTime || !arrTime) return "";
  const [dh, dm] = depTime.split(":").map(Number);
  const [ah, am] = arrTime.split(":").map(Number);
  let mins = (ah * 60 + am) - (dh * 60 + dm);
  if (depDate !== arrDate) mins += 24 * 60;
  if (mins < 0) mins += 24 * 60;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h} ч ${m > 0 ? `${m} мин` : ""}`.trim();
}

/* ───────── Collapsible Section Block (amenities) ───────── */

function SectionBlock({
  icon: Icon, title, content, defaultOpen = false,
}: {
  icon: React.ElementType; title: string; content: string | null | undefined; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (!content) return null;
  const items = content.split(";").map((s) => s.trim()).filter(Boolean);

  return (
    <div className="border border-border/50 rounded-xl overflow-hidden">
      <button
        className="flex items-center gap-3 w-full text-left p-4 hover:bg-muted/30 transition-colors"
        onClick={() => setOpen(!open)}
      >
        <div className="w-8 h-8 rounded-lg bg-brand/10 flex items-center justify-center shrink-0">
          <Icon className="h-4 w-4 text-brand" />
        </div>
        <span className="text-sm font-medium flex-1">{title}</span>
        <span className="text-xs text-muted-foreground mr-2">{items.length}</span>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
            <div className="px-4 pb-4 flex flex-wrap gap-2">
              {items.map((item, i) => (
                <span key={i} className="inline-flex items-center px-2.5 py-1 rounded-full bg-muted/60 text-xs text-foreground/80">{item}</span>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TextSection({ icon: Icon, title, content }: { icon: React.ElementType; title: string; content: string | null | undefined; }) {
  const [expanded, setExpanded] = useState(false);
  if (!content) return null;
  const isLong = content.length > 200;
  const text = isLong && !expanded ? content.slice(0, 200) + "..." : content;
  return (
    <div className="border border-border/50 rounded-xl p-4 space-y-2">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-brand/10 flex items-center justify-center shrink-0"><Icon className="h-4 w-4 text-brand" /></div>
        <h4 className="text-sm font-medium">{title}</h4>
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed pl-11">{text}</p>
      {isLong && <button onClick={() => setExpanded(!expanded)} className="text-brand text-xs font-medium pl-11 hover:underline">{expanded ? "Свернуть" : "Показать полностью"}</button>}
    </div>
  );
}

function InfoChip({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string | null | undefined; }) {
  if (!value) return null;
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/40">
      <Icon className="h-3.5 w-3.5 text-brand shrink-0" />
      <div className="min-w-0">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className="text-xs font-medium truncate">{value}</p>
      </div>
    </div>
  );
}

/* ───────── Flight Segment Card ───────── */

function FlightSegmentCard({ seg, label }: { seg: FlightSegment; label: string }) {
  const duration = calcDuration(seg.departure_time, seg.arrival_time, seg.departure_date, seg.arrival_date);
  return (
    <div className="rounded-xl border border-border/50 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
        <span className="text-xs text-muted-foreground">
          {seg.departure_date}
          {duration && ` · ${duration}`}
        </span>
      </div>

      {/* Airline */}
      <div className="flex items-center gap-2.5">
        {seg.airline_logo && (
          <img src={seg.airline_logo} alt={seg.airline} className="h-6 w-6 rounded object-contain" />
        )}
        <div>
          <p className="text-sm font-medium">{seg.airline}</p>
          <p className="text-[10px] text-muted-foreground">{seg.number}</p>
        </div>
        {seg.on_demand && (
          <Badge variant="outline" className="text-[10px] ml-auto">Под запрос</Badge>
        )}
      </div>

      {/* Timeline */}
      <div className="flex items-center gap-3">
        {/* Departure */}
        <div className="text-center shrink-0">
          <p className="text-lg font-bold">{seg.departure_time}</p>
          <p className="text-[10px] text-muted-foreground">{seg.departure_airport}</p>
          <p className="text-[10px] font-medium text-muted-foreground">{seg.departure_airport_code}</p>
        </div>

        {/* Line */}
        <div className="flex-1 flex flex-col items-center gap-1">
          <p className="text-[10px] text-muted-foreground">{duration}</p>
          <div className="w-full flex items-center">
            <div className="h-px flex-1 bg-brand/40" />
            <Plane className="h-3.5 w-3.5 text-brand mx-1 rotate-0" />
            <div className="h-px flex-1 bg-brand/40" />
          </div>
          <p className="text-[10px] text-muted-foreground">
            {seg.departure_airport_code}
            <ArrowRight className="inline h-2.5 w-2.5 mx-0.5" />
            {seg.arrival_airport_code}
          </p>
        </div>

        {/* Arrival */}
        <div className="text-center shrink-0">
          <p className="text-lg font-bold">{seg.arrival_time}</p>
          <p className="text-[10px] text-muted-foreground">{seg.arrival_airport}</p>
          <p className="text-[10px] font-medium text-muted-foreground">{seg.arrival_airport_code}</p>
        </div>
      </div>

      {/* Baggage / class */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        {seg.baggage && (
          <span className="flex items-center gap-1"><Luggage className="h-3 w-3" />{seg.baggage}</span>
        )}
        {seg.flight_class && (
          <span className="flex items-center gap-1">
            Класс: {seg.flight_class === "Y" ? "Эконом" : seg.flight_class === "C" ? "Бизнес" : seg.flight_class}
          </span>
        )}
      </div>
    </div>
  );
}

/* ───────── Main Component ───────── */

export function HotelDetailPanel({
  card, onClose, onFavorite, isFavorited = false, onOpenGallery,
}: HotelDetailPanelProps) {
  const [hotelInfo, setHotelInfo] = useState<HotelInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [flights, setFlights] = useState<FlightOption[] | null>(null);
  const [flightsLoading, setFlightsLoading] = useState(false);
  const [flightsError, setFlightsError] = useState<string | null>(null);
  const [tab, setTab] = useState<"hotel" | "flight">("hotel");
  const [selectedFlightIdx, setSelectedFlightIdx] = useState(0);
  const [descExpanded, setDescExpanded] = useState(false);
  const [reviewsOpen, setReviewsOpen] = useState(false);

  useEffect(() => {
    if (card.hotel_code == null) { setLoading(false); return; }
    setLoading(true);
    getHotelInfo(card.hotel_code)
      .then(setHotelInfo)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [card.hotel_code]);

  useEffect(() => {
    if (tab !== "flight" || flights !== null || !card.tour_id?.length) return;
    setFlightsLoading(true);
    setFlightsError(null);
    getTourFlights(card.tour_id)
      .then((data) => {
        setFlights(data.flights);
        const defIdx = data.flights.findIndex((f) => f.is_default);
        setSelectedFlightIdx(defIdx >= 0 ? defIdx : 0);
      })
      .catch((err: Error) => {
        setFlights([]);
        setFlightsError(
          err.message.includes("expired")
            ? "expired"
            : "error"
        );
      })
      .finally(() => setFlightsLoading(false));
  }, [tab, flights, card.tour_id]);

  const images = hotelInfo?.images?.map(fixImageUrl).filter(Boolean) ?? [];
  const mainImage = images[0] || fixImageUrl(card.image_url) || "";
  const sideImages = images.slice(1, 3);
  const totalPhotos = hotelInfo?.images_count ?? images.length;

  const handleImageClick = useCallback(
    (idx: number) => { if (images.length > 0 && onOpenGallery) onOpenGallery(images, idx); },
    [images, onOpenGallery]
  );

  const description = hotelInfo?.description || "";
  const isDescLong = description.length > 250;
  const descText = isDescLong && !descExpanded ? description.slice(0, 250) + "..." : description;

  const ratingLabel =
    parseFloat(card.hotel_rating) >= 4.5 ? "Отлично" :
    parseFloat(card.hotel_rating) >= 4.0 ? "Очень хорошо" :
    parseFloat(card.hotel_rating) >= 3.5 ? "Хорошо" :
    parseFloat(card.hotel_rating) >= 3.0 ? "Нормально" : "Средне";

  const mapUrl = hotelInfo?.coordinates?.lat && hotelInfo?.coordinates?.lon
    ? `https://maps.google.com/maps?q=${hotelInfo.coordinates.lat},${hotelInfo.coordinates.lon}` : null;

  return (
    <motion.div
      initial={{ x: 300, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 300, opacity: 0 }}
      transition={{ type: "spring", damping: 30, stiffness: 300 }}
      className="w-full border-l border-border bg-background flex flex-col h-full"
    >
      {/* ── Sticky header ── */}
      <div className="shrink-0 border-b border-border">
        <div className="flex items-center justify-between px-5 py-3">
          <h3 className="text-sm font-semibold truncate pr-4">{card.hotel_name}</h3>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={() => onFavorite?.(card)} className="p-2.5 hover:bg-muted rounded-lg transition-colors">
              <Heart className={cn("h-4 w-4 transition-all", isFavorited ? "fill-red-500 text-red-500" : "text-muted-foreground")} />
            </button>
            <button
              onClick={() => {
                if (card.hotel_link) {
                  navigator.clipboard.writeText(card.hotel_link).catch(() => {});
                }
              }}
              className="p-2.5 hover:bg-muted rounded-lg transition-colors"
              title="Скопировать ссылку"
            >
              <Share2 className="h-4 w-4 text-muted-foreground" />
            </button>
            <button onClick={onClose} className="p-2.5 hover:bg-muted rounded-lg transition-colors">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="flex px-5 gap-1">
          <button
            onClick={() => setTab("hotel")}
            className={cn(
              "flex-1 py-2.5 text-sm font-medium rounded-t-lg transition-colors text-center",
              tab === "hotel"
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            Отель
          </button>
          <button
            onClick={() => setTab("flight")}
            className={cn(
              "flex-1 py-2.5 text-sm font-medium rounded-t-lg transition-colors text-center",
              tab === "flight"
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            Перелёт
          </button>
        </div>
      </div>

      {/* ── Scrollable content ── */}
      <div className="flex-1 overflow-y-auto overscroll-contain min-h-0">
        {tab === "hotel" ? (
          /* ═══════════ HOTEL TAB ═══════════ */
          <div className="p-5 space-y-5">
            {/* Name & Rating */}
            <div>
              <h2 className="text-xl font-bold leading-tight">
                {card.hotel_name} {card.hotel_stars}
                <Star className="inline h-4 w-4 ml-0.5 text-amber-400 fill-amber-400" />
              </h2>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <Badge className="bg-brand text-white text-xs font-bold px-2.5 py-0.5">{card.hotel_rating}</Badge>
                <span className="text-sm text-muted-foreground">{ratingLabel}</span>
                {(hotelInfo?.reviews_count || 0) > 0 && (
                  <span className="text-xs text-brand">{hotelInfo!.reviews_count} отзывов</span>
                )}
              </div>
              <div className="flex items-center gap-1.5 mt-1.5">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  {hotelInfo?.placement ? `${card.resort}, ${card.country} · ${hotelInfo.placement}` : `${card.resort}, ${card.country}`}
                </span>
              </div>
            </div>

            {/* Photo Gallery Grid */}
            {loading ? (
              <div className="grid grid-cols-3 gap-2"><Skeleton className="col-span-2 h-56" /><div className="space-y-2"><Skeleton className="h-[108px]" /><Skeleton className="h-[108px]" /></div></div>
            ) : (
              <div className="grid grid-cols-3 gap-2 rounded-xl overflow-hidden">
                <div className="col-span-2 h-56 cursor-pointer relative group" onClick={() => handleImageClick(0)}>
                  {mainImage ? (
                    <img src={mainImage} alt={card.hotel_name} className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-brand-light to-brand/30 flex items-center justify-center"><span className="text-5xl">🏨</span></div>
                  )}
                </div>
                <div className="space-y-2">
                  {sideImages.length > 0 ? sideImages.map((url, i) => (
                    <div key={i} className="h-[108px] cursor-pointer relative group overflow-hidden" onClick={() => handleImageClick(i + 1)}>
                      <img src={url} alt={`${card.hotel_name} ${i + 2}`} className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300" />
                      {i === 1 && totalPhotos > 3 && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center"><span className="text-white text-sm font-semibold">+{totalPhotos - 3} фото</span></div>
                      )}
                    </div>
                  )) : (<><div className="h-[108px] bg-muted rounded-lg" /><div className="h-[108px] bg-muted rounded-lg" /></>)}
                </div>
              </div>
            )}

            {/* Quick facts */}
            {!loading && (
              <div className="grid grid-cols-2 gap-2">
                <InfoChip icon={Waves} label="До пляжа" value={card.sea_distance ? card.sea_distance : hotelInfo?.seadistance ? `${hotelInfo.seadistance} м` : undefined} />
                <InfoChip icon={Calendar} label="Построен" value={hotelInfo?.build} />
                <InfoChip icon={Sparkles} label="Реновация" value={hotelInfo?.repair} />
                <InfoChip icon={Ruler} label="Площадь" value={hotelInfo?.square} />
                <InfoChip icon={Star} label="Рейтинг" value={`${card.hotel_rating} · ${ratingLabel}`} />
                <InfoChip icon={Building2} label="Категория" value={`${card.hotel_stars} звёзд`} />
              </div>
            )}

            {/* Description */}
            {loading ? (
              <div className="space-y-2"><Skeleton className="h-5 w-32" /><Skeleton className="h-24 w-full" /></div>
            ) : description ? (
              <div className="space-y-2">
                <h3 className="font-semibold text-base">Про отель</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{descText}</p>
                {isDescLong && (
                  <button onClick={() => setDescExpanded(!descExpanded)} className="text-brand text-sm font-medium hover:underline">
                    {descExpanded ? "Свернуть" : "Показать ещё"}
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <h3 className="font-semibold text-base">Про отель</h3>
                <p className="text-sm text-muted-foreground">
                  {card.resort}, {card.country}. {card.hotel_stars} звёзд.
                  {card.sea_distance && ` ${card.sea_distance} до пляжа.`}
                  {card.meal_description && ` Питание: ${card.meal_description}.`}
                </p>
              </div>
            )}

            {/* Booking card */}
            <div className="rounded-xl border border-brand/20 bg-brand/[0.03] p-4 space-y-3">
              <div className="flex flex-col sm:flex-row items-start sm:justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-2xl font-bold">от {formatPrice(card.price)}</p>
                  <p className="text-xs text-muted-foreground">{card.nights} ночей</p>
                </div>
                {card.hotel_link ? (
                  <Button className="bg-brand hover:bg-brand-dark text-white font-semibold px-5 shrink-0 w-full sm:w-auto" asChild>
                    <a href={card.hotel_link} target="_blank" rel="noopener noreferrer">
                      Забронировать на mgp.ru<ExternalLink className="h-3.5 w-3.5 ml-1.5" />
                    </a>
                  </Button>
                ) : (
                  <Button className="bg-muted text-muted-foreground font-semibold px-5 shrink-0" disabled>
                    Недоступно
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2 pt-2 border-t border-border/30">
                <ShieldCheck className="h-3.5 w-3.5 text-brand shrink-0" />
                <p className="text-[11px] text-muted-foreground leading-tight">
                  Оформление тура на сайте «Магазин Горящих Путёвок». 27 лет на рынке · 200+ офисов по России
                </p>
              </div>
            </div>

            {/* Tour details */}
            <div className="rounded-xl border border-border/50 p-4">
              <h4 className="text-sm font-semibold mb-3">Детали тура</h4>
              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Даты</span><span className="font-medium">{card.date_from} – {card.date_to}</span></div>
                {card.placement && <div className="flex justify-between"><span className="text-muted-foreground">Размещение</span><span className="font-medium">{card.placement}</span></div>}
                {card.meal_description && <div className="flex justify-between"><span className="text-muted-foreground">Питание</span><span className="font-medium">{card.meal_description}</span></div>}
                {card.departure_city && <div className="flex justify-between"><span className="text-muted-foreground">Вылет</span><span className="font-medium">{card.departure_city}</span></div>}
                {card.flight_included && <div className="flex justify-between"><span className="text-muted-foreground">Перелёт</span><span className="font-medium text-green-600">Включён</span></div>}
              </div>
            </div>

            {/* Amenities */}
            {!loading && hotelInfo && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }} className="space-y-3">
                <h3 className="font-semibold text-base">Удобства и услуги</h3>
                <SectionBlock icon={TreePalm} title="Территория и инфраструктура" content={hotelInfo.territory} defaultOpen />
                <SectionBlock icon={Waves} title="Пляж" content={hotelInfo.beach} defaultOpen />
                <SectionBlock icon={Baby} title="Для детей" content={hotelInfo.child} />
                <SectionBlock icon={Bed} title="В номере" content={hotelInfo.inroom} />
                <TextSection icon={Building2} title="Типы номеров" content={hotelInfo.roomtypes} />
                <SectionBlock icon={Dumbbell} title="Бесплатные услуги" content={hotelInfo.services} />
                <SectionBlock icon={Wifi} title="Бесплатно" content={hotelInfo.servicefree} />
                <SectionBlock icon={CreditCard} title="Платные услуги" content={hotelInfo.servicepay} />
                <TextSection icon={UtensilsCrossed} title="Питание" content={[hotelInfo.meallist, hotelInfo.mealtypes].filter(Boolean).join(". ") || null} />
                <SectionBlock icon={Music} title="Развлечения и анимация" content={hotelInfo.animation} />
              </motion.div>
            )}

            {/* Contacts */}
            {!loading && hotelInfo && (hotelInfo.phone || hotelInfo.site || mapUrl) && (
              <div className="space-y-3">
                <h3 className="font-semibold text-base">Контакты</h3>
                <div className="rounded-xl border border-border/50 p-4 space-y-3">
                  {hotelInfo.phone && <div className="flex items-center gap-3"><Phone className="h-4 w-4 text-brand shrink-0" /><span className="text-sm">{hotelInfo.phone}</span></div>}
                  {hotelInfo.site && <div className="flex items-center gap-3"><Globe className="h-4 w-4 text-brand shrink-0" /><a href={hotelInfo.site.startsWith("http") ? hotelInfo.site : `https://${hotelInfo.site}`} target="_blank" rel="noopener noreferrer" className="text-sm text-brand hover:underline truncate">{hotelInfo.site.replace(/^https?:\/\//, "")}</a></div>}
                  {mapUrl && <div className="flex items-center gap-3"><Navigation className="h-4 w-4 text-brand shrink-0" /><a href={mapUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-brand hover:underline">Открыть на карте</a></div>}
                </div>
              </div>
            )}

            {/* ── Mini Map ── */}
            {!loading && hotelInfo?.coordinates?.lat && hotelInfo?.coordinates?.lon &&
              parseFloat(hotelInfo.coordinates.lat) !== 0 && parseFloat(hotelInfo.coordinates.lon) !== 0 && (
              <div className="space-y-3">
                <h3 className="font-semibold text-base">Расположение</h3>
                <HotelMap
                  singleHotel={{
                    lat: parseFloat(hotelInfo.coordinates.lat),
                    lng: parseFloat(hotelInfo.coordinates.lon),
                    name: card.hotel_name,
                    stars: card.hotel_stars,
                  }}
                  className="h-48 w-full"
                  compact
                />
              </div>
            )}

            {/* ── Reviews (collapsible) ── */}
            {!loading && hotelInfo?.reviews && hotelInfo.reviews.length > 0 && (
              <div className="space-y-3">
                <button
                  onClick={() => setReviewsOpen(!reviewsOpen)}
                  className="flex items-center gap-3 w-full text-left group"
                >
                  <div className="flex items-center gap-2 flex-1">
                    <h3 className="font-semibold text-base">Отзывы</h3>
                    <Badge className="bg-amber-100 text-amber-700 text-xs font-bold px-2">
                      <Star className="h-3 w-3 fill-amber-500 text-amber-500 mr-0.5" />
                      {card.hotel_rating}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {hotelInfo.reviews_count || hotelInfo.reviews.length} отзывов
                    </span>
                  </div>
                  {reviewsOpen
                    ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </button>

                <AnimatePresence>
                  {reviewsOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className="overflow-hidden space-y-3"
                    >
                      {hotelInfo.reviews.map((review, i) => (
                        <div key={i} className="rounded-xl border border-border/50 p-4 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">{review.name}</span>
                            <div className="flex items-center gap-1.5">
                              <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
                              <span className="text-sm font-bold">{review.rate}</span>
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground leading-relaxed">{review.content}</p>
                          {review.traveltime && <p className="text-xs text-muted-foreground/60">{review.traveltime}</p>}
                        </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {loading && (
              <div className="space-y-4">
                <Skeleton className="h-5 w-40" /><Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" /><Skeleton className="h-14 w-full" />
              </div>
            )}
            <div className="h-6" />
          </div>
        ) : (
          /* ═══════════ FLIGHT TAB ═══════════ */
          <div className="p-5 space-y-5">
            {!card.flight_included ? (
              <div className="text-center py-16 space-y-3">
                <Plane className="h-10 w-10 text-muted-foreground/40 mx-auto" />
                <p className="text-sm text-muted-foreground">Этот тур без перелёта</p>
              </div>
            ) : flightsLoading ? (
              <div className="flex flex-col items-center justify-center py-20 space-y-6">
                {/* Animated plane flying across */}
                <div className="relative w-48 h-16">
                  <motion.div
                    animate={{ x: ["-40px", "200px"] }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute top-0"
                  >
                    <Plane className="h-8 w-8 text-brand -rotate-12" />
                  </motion.div>
                  {/* Dashed flight path */}
                  <div className="absolute top-4 left-0 right-0 border-t-2 border-dashed border-brand/20" />
                  {/* Clouds */}
                  <motion.div
                    animate={{ opacity: [0.3, 0.7, 0.3], x: [0, -10, 0] }}
                    transition={{ duration: 3, repeat: Infinity }}
                    className="absolute top-1 right-4 text-2xl select-none"
                  >☁️</motion.div>
                  <motion.div
                    animate={{ opacity: [0.5, 0.2, 0.5], x: [0, 8, 0] }}
                    transition={{ duration: 2.5, repeat: Infinity, delay: 0.5 }}
                    className="absolute top-6 right-16 text-lg select-none"
                  >☁️</motion.div>
                </div>

                <div className="text-center space-y-2">
                  <motion.p
                    animate={{ opacity: [0.6, 1, 0.6] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="text-sm font-medium text-foreground"
                  >
                    Ищем лучшие варианты перелёта
                  </motion.p>
                  <p className="text-xs text-muted-foreground">Сравниваем рейсы и цены...</p>
                </div>

                {/* Pulsing dots */}
                <div className="flex gap-1.5">
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      className="w-2 h-2 rounded-full bg-brand"
                      animate={{ scale: [1, 1.4, 1], opacity: [0.4, 1, 0.4] }}
                      transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                    />
                  ))}
                </div>
              </div>
            ) : !flights || flights.length === 0 ? (
              <div className="text-center py-16 space-y-3">
                <Plane className="h-10 w-10 text-muted-foreground/40 mx-auto" />
                {flightsError === "expired" ? (
                  <>
                    <p className="text-sm text-muted-foreground">Данные тура устарели</p>
                    <p className="text-xs text-muted-foreground/60">Выполните новый поиск в чате, чтобы получить актуальную информацию о перелётах.</p>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">Информация о перелётах недоступна</p>
                    <p className="text-xs text-muted-foreground/60">
                      {!card.tour_id?.length
                        ? "Данные тура не содержат информацию о рейсах."
                        : "Не удалось загрузить данные. Попробуйте позже."}
                    </p>
                    {card.tour_id?.length && (
                      <button
                        onClick={() => { setFlights(null); setFlightsError(null); }}
                        className="text-brand text-sm font-medium hover:underline"
                      >
                        Попробовать снова
                      </button>
                    )}
                  </>
                )}
              </div>
            ) : (() => {
              const selected = flights[selectedFlightIdx] || flights[0];
              const fwd = selected.forward[0];
              const bwd = selected.backward[0];
              const fwdDuration = fwd ? calcDuration(fwd.departure_time, fwd.arrival_time, fwd.departure_date, fwd.arrival_date) : "";
              const bwdDuration = bwd ? calcDuration(bwd.departure_time, bwd.arrival_time, bwd.departure_date, bwd.arrival_date) : "";

              return (
                <>
                  {/* Tariff */}
                  <div className="rounded-xl border border-border/50 p-4 space-y-2">
                    <h4 className="text-sm font-semibold">Условия тарифа</h4>
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Luggage className="h-3.5 w-3.5" />Багаж по тарифу авиакомпании</span>
                      <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />Безвозвратный тариф</span>
                    </div>
                  </div>

                  {/* Variant selector */}
                  {flights.length > 1 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Выберите рейс · {flights.length} вариантов
                      </p>
                      <div className="flex gap-2 overflow-x-auto pb-1">
                        {flights.map((f, fi) => {
                          const seg = f.forward[0];
                          const isActive = fi === selectedFlightIdx;
                          return (
                            <button
                              key={fi}
                              onClick={() => setSelectedFlightIdx(fi)}
                              className={cn(
                                "shrink-0 rounded-xl border p-3 text-left transition-all min-w-[160px]",
                                isActive
                                  ? "border-brand bg-brand/5 ring-1 ring-brand"
                                  : "border-border/50 hover:border-brand/40 hover:bg-muted/30"
                              )}
                            >
                              <div className="flex items-center gap-2 mb-1.5">
                                {seg?.airline_logo && <img src={seg.airline_logo} alt="" className="h-4 w-4 rounded object-contain" />}
                                <span className="text-xs font-medium truncate">{seg?.airline}</span>
                              </div>
                              <p className="text-[10px] text-muted-foreground">
                                {seg?.departure_time} → {seg?.arrival_time}
                              </p>
                              <p className="text-xs font-bold mt-1">от {formatPrice(f.price)}</p>
                              {f.is_default && <Badge className="bg-brand/10 text-brand text-[9px] mt-1 px-1.5 py-0">Рекомендуем</Badge>}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Selected flight — forward */}
                  <div className="space-y-3">
                    <h3 className="font-semibold text-base flex items-center gap-2">
                      {card.departure_city || "Москва"}
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      {card.resort}
                    </h3>
                    <p className="text-xs text-muted-foreground -mt-1">
                      {selected.date_forward}
                      {fwdDuration && ` · ${fwdDuration}`}
                    </p>
                    {selected.forward.map((seg, i) => (
                      <FlightSegmentCard key={i} seg={seg} label={selected.forward.length > 1 ? `Рейс ${i + 1}` : "Прямой рейс"} />
                    ))}
                  </div>

                  {/* Selected flight — backward */}
                  <div className="space-y-3">
                    <h3 className="font-semibold text-base flex items-center gap-2">
                      {card.resort}
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      {card.departure_city || "Москва"}
                    </h3>
                    <p className="text-xs text-muted-foreground -mt-1">
                      {selected.date_backward}
                      {bwdDuration && ` · ${bwdDuration}`}
                    </p>
                    {selected.backward.map((seg, i) => (
                      <FlightSegmentCard key={i} seg={seg} label={selected.backward.length > 1 ? `Рейс ${i + 1}` : "Прямой рейс"} />
                    ))}
                  </div>

                  {/* Booking CTA */}
                  <div className="rounded-xl border border-brand/20 bg-brand/[0.03] p-4 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xl font-bold">от {formatPrice(selected.price || card.price)}</p>
                        <p className="text-xs text-muted-foreground">{card.nights} ночей</p>
                      </div>
                      {card.hotel_link ? (
                        <Button className="bg-brand hover:bg-brand-dark text-white font-semibold px-5 shrink-0" asChild>
                          <a href={card.hotel_link} target="_blank" rel="noopener noreferrer">
                            Забронировать на mgp.ru<ExternalLink className="h-3.5 w-3.5 ml-1.5" />
                          </a>
                        </Button>
                      ) : (
                        <Button className="bg-muted text-muted-foreground font-semibold px-5 shrink-0" disabled>
                          Недоступно
                        </Button>
                      )}
                    </div>
                    <div className="flex items-center gap-2 pt-2 border-t border-border/30">
                      <ShieldCheck className="h-3.5 w-3.5 text-brand shrink-0" />
                      <p className="text-[11px] text-muted-foreground leading-tight">
                        Оформление тура на сайте «Магазин Горящих Путёвок». 27 лет на рынке · 200+ офисов по России
                      </p>
                    </div>
                  </div>
                </>
              );
            })()}
            <div className="h-6" />
          </div>
        )}
      </div>
    </motion.div>
  );
}
