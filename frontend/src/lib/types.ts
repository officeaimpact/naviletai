export type FavoriteRefreshStatus = "ok" | "expired" | "unavailable" | "error";

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
  on_demand: boolean;
}

export interface FlightOption {
  forward: FlightSegment[];
  backward: FlightSegment[];
  date_forward: string;
  date_backward: string;
  price: number;
  currency: string;
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
}

export interface ChatResponse {
  reply: string;
  tour_cards: TourCard[];
  conversation_id: string;
  error?: string;
}

export interface ChatSession {
  id: string;
  title: string;
  lastMessage: string;
  timestamp: number;
  messages: ChatMessage[];
}
