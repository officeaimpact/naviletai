"use client";

import { TourCard as TourCardType } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Heart, Star } from "lucide-react";
import {
  formatPrice,
  formatPricePerNight,
  getRatingLabel,
  getFlightStatusLabel,
  getHotelStatusLabel,
} from "@/lib/format";
import { fixImageUrl } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface TourCardProps {
  card: TourCardType;
  onDetails?: (card: TourCardType) => void;
  onFavorite?: (card: TourCardType) => void;
  isFavorited?: boolean;
}

export function TourCardComponent({
  card,
  onDetails,
  onFavorite,
  isFavorited = false,
}: TourCardProps) {
  const flightWarning = getFlightStatusLabel(card.flight_status ?? 0);
  const hotelStatus = getHotelStatusLabel(card.hotel_status ?? 0);
  const priceLabel = card.price_per_person ? "за человека" : "";
  const imgSrc = fixImageUrl(card.image_url);
  const [imgError, setImgError] = useState(false);

  return (
    <div
      className="group flex flex-col sm:flex-row gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl border border-border bg-card
                 hover:shadow-lg hover:-translate-y-0.5
                 transition-all duration-200 cursor-pointer"
      onClick={() => onDetails?.(card)}
    >
      {/* Hotel Photo */}
      <div className="w-full h-40 sm:w-40 sm:h-28 rounded-lg shrink-0 overflow-hidden relative">
        {imgSrc && !imgError ? (
          <img
            src={imgSrc}
            alt={card.hotel_name}
            loading="lazy"
            onError={() => setImgError(true)}
            className="w-full h-full object-cover
                       group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-brand-light to-brand/20 flex items-center justify-center">
            <span className="text-3xl">🏨</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-semibold text-sm leading-tight">
              {card.hotel_name} {card.hotel_stars}
              <Star className="inline h-3 w-3 ml-0.5 text-amber-400 fill-amber-400" />
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {card.resort} · {card.country}
              {card.sea_distance && ` · ${card.sea_distance} до пляжа`}
            </p>
          </div>

          {/* Rating */}
          <div className="text-right shrink-0">
            <span className="text-xs text-muted-foreground">
              {getRatingLabel(card.hotel_rating)}
            </span>
            <div className="text-sm font-bold text-brand">
              {card.hotel_rating}
            </div>
          </div>
        </div>

        {/* Badges */}
        <div className="flex flex-wrap gap-1 mt-2">
          {card.meal_description && (
            <Badge variant="secondary" className="text-[10px]">
              {card.meal_description}
            </Badge>
          )}
          {card.is_hot_tour && (
            <Badge className="bg-red-500 text-white text-[10px]">
              Горящий тур
            </Badge>
          )}
          {card.on_request && (
            <Badge variant="outline" className="text-[10px]">
              Под запрос
            </Badge>
          )}
          {card.promo && (
            <Badge className="bg-green-500 text-white text-[10px]">
              Промо
            </Badge>
          )}
          {(card.night_flight ?? 0) > 0 && (
            <Badge variant="outline" className="text-[10px]">
              Ночной перелёт
            </Badge>
          )}
          {flightWarning && (
            <Badge variant="destructive" className="text-[10px]">
              {flightWarning}
            </Badge>
          )}
          {hotelStatus && (
            <Badge
              variant={(card.hotel_status ?? 0) === 2 ? "default" : "outline"}
              className={cn(
                "text-[10px]",
                card.hotel_status === 2 && "bg-green-500 text-white"
              )}
            >
              {hotelStatus}
            </Badge>
          )}
        </div>

        {/* Price & Actions */}
        <div className="flex items-end justify-between mt-3">
          <div>
            {card.is_hot_tour && card.old_price && (
              <span className="text-xs text-muted-foreground line-through mr-2">
                {formatPrice(card.old_price)}
              </span>
            )}
            <span className="font-bold text-lg">
              от {formatPrice(card.price)}
            </span>
            {priceLabel && (
              <span className="text-xs text-muted-foreground ml-1">
                {priceLabel}
              </span>
            )}
            <p className="text-xs text-muted-foreground">
              {card.nights} ночей · {formatPricePerNight(card.price, card.nights)}
            </p>
            <p className="text-[10px] text-muted-foreground/60 mt-0.5">через mgp.ru</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); onFavorite?.(card); }}
              className="p-2.5 hover:text-red-500 transition-colors"
            >
              <Heart
                className={cn(
                  "h-5 w-5 transition-all",
                  isFavorited
                    ? "fill-red-500 text-red-500 scale-110"
                    : "text-muted-foreground"
                )}
              />
            </button>
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => { e.stopPropagation(); onDetails?.(card); }}
              className="border-brand text-brand hover:bg-brand hover:text-white transition-all"
            >
              Подробнее
            </Button>
          </div>
        </div>

        {card._warning && (
          <p className="text-xs text-amber-600 mt-2">{card._warning}</p>
        )}
        {card._refreshStatus && card._refreshStatus !== "ok" && card._refreshMessage && (
          <p
            className={cn(
              "text-xs mt-1.5",
              card._refreshStatus === "expired" && "text-amber-600",
              (card._refreshStatus === "unavailable" || card._refreshStatus === "error") &&
                "text-red-500"
            )}
          >
            {card._refreshMessage}
          </p>
        )}
      </div>
    </div>
  );
}
