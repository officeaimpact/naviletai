export type FavoriteRefreshStatus = "ok" | "expired" | "unavailable" | "error";

export type CardFlagSeverity =
  | "info"
  | "warning"
  | "risk"
  /** Главный recommend-бейдж (логика продажи): 💎 Премиум · 🥇 Лучший · 💰 Дешевле */
  | "recommend"
  /** Match под профиль клиента: 👨‍👩‍👧 Для семьи · 💕 Для пары */
  | "match";

export interface CardFlag {
  type: string;
  severity: CardFlagSeverity;
  label: string;
}

export interface TourCard {
  hotel_name: string;
  hotel_stars: number;
  hotel_rating: string;
  country: string;
  resort: string;
  price: number;
  price_per_person?: boolean;
  currency?: string;
  date_from: string;
  date_to: string;
  nights: number;
  meal_code?: string;
  meal_description?: string;
  room_type?: string;
  placement?: string;
  adults?: number;
  children?: number;
  departure_city?: string;
  operator?: string;
  flight_included?: boolean;
  tour_id: string;
  hotel_code?: number;
  hotel_link?: string;
  image_url?: string | null;
  sea_distance?: string;
  on_request?: boolean;
  flight_status?: number;
  hotel_status?: number;
  night_flight?: number;
  promo?: boolean;
  is_hot_tour?: boolean;
  old_price?: number | null;
  discount_percent?: number | null;
  _position?: number;
  _warning?: string | null;
  _adults_only_warning?: string | null;
  _refreshStatus?: FavoriteRefreshStatus | null;
  _refreshMessage?: string | null;
  /** Backend-вычисленные «красные флаги» (rating_low, night_flight, on_request,
   *  far_sea, kid_unfriendly, not_quiet и т.д.). Рендерятся бейджами на карточке. */
  flags?: CardFlag[] | null;
  /** Если агент в HotelDetailPanel зафиксировал конкретный перелёт. */
  selected_flight?: FlightOption | null;
  /** Короткая подпись о выбранном рейсе для бейджа на карточке. */
  flight_summary?: string | null;
}

export interface HotelReview {
  name: string;
  rate: number;
  content: string;
  traveltime: string;
}

export interface HotelInfo {
  name: string;
  stars: number;
  rating: string;
  country: string;
  region: string;
  seadistance: string;
  build: string;
  repair: string;
  square: string;
  phone: string;
  site: string;
  placement: string;
  description: string;
  territory: string;
  beach: string;
  child: string;
  inroom: string;
  roomtypes: string;
  services: string;
  servicefree: string;
  servicepay: string;
  meallist: string;
  mealtypes: string;
  animation: string;
  images: string[];
  images_count: number;
  coordinates: { lat: string; lon: string };
  reviews: HotelReview[];
  reviews_count: number;
}

export interface FlightSegment {
  number: string;
  airline: string;
  airline_code?: string;
  airline_logo: string;
  departure_date: string;
  departure_time: string;
  departure_airport: string;
  departure_airport_code: string;
  arrival_date: string;
  arrival_time: string;
  arrival_airport: string;
  arrival_airport_code: string;
  flight_class: string;
  baggage: string | null;
  carry_on?: string | null;
  on_demand: boolean;
  no_places?: boolean;
}

export interface FlightOption {
  forward: FlightSegment[];
  backward: FlightSegment[];
  date_forward: string;
  date_backward: string;
  price: number;
  currency: string;
  fuel_charge?: number;
  is_default: boolean;
}

export interface TourFlights {
  flights: FlightOption[];
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  tour_cards?: TourCard[];
  timestamp: number;
  /** Если backend заблокировал search_tours — первый недостающий слот. */
  cascade_missing?: string | null;
  /** Слоты, известные backend на момент ответа (показываем только в фазе сбора). */
  slots?: Record<string, string> | null;
  /** Признак фазы сбора параметров (рендер чипов). */
  cascade_phase?: boolean;
}

export type CopilotIntent =
  | "new_search"
  | "refine"
  | "hotel_info"
  | "hot_tours"
  | "client_message"
  | "comparison"
  | "consultation"
  | "cascade_block"
  | "llm_error"
  | null;

export interface ChatResponse {
  reply: string;
  tour_cards: TourCard[];
  conversation_id: string;
  error?: string;
  /** Намерение хода: cascade_block / new_search / hotel_info … */
  turn_intent?: CopilotIntent;
  /** Слоты, выцепленные backend regex-ами из истории сообщений. */
  slots_collected?: Record<string, string>;
  /** Если backend заблокировал search_tours — какой первый недостающий слот. */
  cascade_missing?: string | null;
  /** Готовый «один вопрос» к агенту, который backend подсказывает LLM. */
  cascade_nudge?: string | null;
  /** Какие функции backend вызвал в этом ходе (для дев-логов / debug). */
  tool_trace?: string[];
  /** Источник ответа: tourvisor_api / agent / hotel_info / cascade_block / … */
  source?: string;
  /** Лёгкий профиль клиента (≤200 симв.), накопленный backend-ом из переписки.
   *  Отображается чипом над инпутом; null/undefined = чип скрыт. */
  client_profile?: string | null;
}

export interface ChatSession {
  id: string;
  title: string;
  lastMessage: string;
  timestamp: number;
  messages: ChatMessage[];
}
