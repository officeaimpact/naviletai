export function formatPrice(price: number, currency = "RUB"): string {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(price);
}

export function formatPricePerNight(
  price: number,
  nights: number,
  currency = "RUB"
): string {
  const perNight = Math.round(price / nights);
  return `от ${new Intl.NumberFormat("ru-RU").format(perNight)}₽ за ночь`;
}

export function getMealLabel(code: string): string {
  const meals: Record<string, string> = {
    ro: "Без питания",
    bb: "Завтраки",
    hb: "Полупансион",
    fb: "Полный пансион",
    ai: "Всё включено",
    uai: "Ультра всё включено",
  };
  return meals[code] || code;
}

export function getStarsDisplay(stars: number): string {
  return "★".repeat(stars);
}

export function getRatingLabel(rating: string): string {
  const num = parseFloat(rating);
  if (num >= 4.5) return "Очень хорошо";
  if (num >= 4.0) return "Хорошо";
  if (num >= 3.5) return "Нормально";
  return "Удовлетворительно";
}

export function getFlightStatusLabel(status: number): string | null {
  if (status === 1) return "Рейс под запрос";
  if (status === 2) return "Мало мест на рейсе!";
  return null;
}

export function getHotelStatusLabel(status: number): string | null {
  if (status === 1) return "Под запрос";
  if (status === 2) return "Мгновенное подтверждение";
  return null;
}
