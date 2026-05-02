"""Demo dataset for Tourvisor AI Copilot.

Used when TOURVISOR_AUTH_LOGIN/PASS are not configured.
All photos are public Unsplash URLs and are intended for local demo only.
"""

from __future__ import annotations

from typing import Any, Dict, List


DEMO_HOTELS: List[Dict[str, Any]] = [
    {
        "hotel_code": 700121,
        "hotel_name": "Rixos Premium Belek",
        "hotel_stars": 5,
        "hotel_rating": "4.8",
        "country": "Турция",
        "country_code": 4,
        "resort": "Белек",
        "region_code": 8,
        "price": 285000,
        "currency": "RUB",
        "nights": 7,
        "meal_code": "AI",
        "meal_description": "Всё включено",
        "room_type": "Standard Room",
        "placement": "2 взрослых",
        "operator": "TUI",
        "image_url": "https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=1400&q=80",
        "sea_distance": "1 линия",
        "tags": ["all_inclusive", "family", "premium", "beach", "kids"],
        "description": (
            "Премиальный all-inclusive в Белеке: огромная территория, аквапарк, "
            "отдельный детский клуб, мишленовская гастрономия и 600 м собственного пляжа."
        ),
        "highlights": [
            "Аквапарк с 7 горками и детской зоной",
            "Анимация Rixy Kids Club для детей 4-12 лет",
            "5 ресторанов à la carte без доплат",
            "Прямой выход на песчано-галечный пляж",
        ],
        "images": [
            "https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=1600&q=80",
            "https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?auto=format&fit=crop&w=1600&q=80",
            "https://images.unsplash.com/photo-1564501049412-61c2a3083791?auto=format&fit=crop&w=1600&q=80",
            "https://images.unsplash.com/photo-1568084680786-a84f91d1153c?auto=format&fit=crop&w=1600&q=80",
        ],
        "rooms": "Standard Room; Family Room; Suite Sea View",
        "services": "spa; 4 бассейна; аквапарк; фитнес; теннис; яхт-клуб",
        "servicefree": "Wi-Fi; пляжные полотенца; мини-бар; вечерняя анимация",
        "child": "детский клуб 4-12; мини-диско; детское меню; нянька по запросу",
        "beach": "1 линия; 600 м; песчано-галечный; шезлонги бесплатно",
        "mealtypes": "Ultra All Inclusive; à la carte; диетическое меню",
        "_warning": None,
    },
    {
        "hotel_code": 700233,
        "hotel_name": "Maxx Royal Kemer",
        "hotel_stars": 5,
        "hotel_rating": "4.9",
        "country": "Турция",
        "country_code": 4,
        "resort": "Кемер",
        "region_code": 22,
        "price": 320000,
        "currency": "RUB",
        "nights": 7,
        "meal_code": "UAI",
        "meal_description": "Ультра всё включено",
        "room_type": "Deluxe Room Sea View",
        "placement": "2 взрослых",
        "operator": "ANEX Tour",
        "image_url": "https://images.unsplash.com/photo-1610641818989-c2051b5e2cfd?auto=format&fit=crop&w=1400&q=80",
        "sea_distance": "1 линия",
        "tags": ["ultra_all_inclusive", "premium", "honeymoon", "beach", "kids"],
        "description": (
            "Бутиковый ультра-AI в Кемере. Гора Тахталы прямо над отелем, "
            "приватный пляж с пирсом, гастро-программы и спа-комплекс 2500 м²."
        ),
        "highlights": [
            "Ультра all inclusive с премиум-алкоголем",
            "Спа 2500 м² с хаммамом и римскими банями",
            "Приватный причал и пляж 350 м",
            "Зал Maxx Kids c педагогами и кулинарной школой",
        ],
        "images": [
            "https://images.unsplash.com/photo-1602002418816-5c0aeef426aa?auto=format&fit=crop&w=1600&q=80",
            "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=1600&q=80",
            "https://images.unsplash.com/photo-1551776235-dde6d4829808?auto=format&fit=crop&w=1600&q=80",
            "https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=1600&q=80",
        ],
        "rooms": "Deluxe Sea View; Family Suite; Honeymoon Suite",
        "services": "spa 2500 м²; крытый и открытый бассейны; фитнес; яхта",
        "servicefree": "Wi-Fi; полотенца; мини-бар премиум; ужин à la carte ежедневно",
        "child": "Maxx Kids 4-12; кулинарная школа; мини-аквапарк",
        "beach": "1 линия; 350 м; галечно-песчаный; зонты и шезлонги",
        "mealtypes": "Ultra All Inclusive; à la carte; премиум-алкоголь",
        "_warning": None,
    },
    {
        "hotel_code": 700412,
        "hotel_name": "Crystal Family Resort & Spa",
        "hotel_stars": 5,
        "hotel_rating": "4.6",
        "country": "Турция",
        "country_code": 4,
        "resort": "Белек",
        "region_code": 8,
        "price": 215000,
        "currency": "RUB",
        "nights": 7,
        "meal_code": "AI",
        "meal_description": "Всё включено",
        "room_type": "Family Room",
        "placement": "2+1 (ребёнок 6 лет)",
        "operator": "Pegas Touristik",
        "image_url": "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=1400&q=80",
        "sea_distance": "150 м до моря",
        "tags": ["family", "all_inclusive", "kids", "beach"],
        "description": (
            "Один из самых популярных семейных AI-отелей Белека: огромный аквапарк, "
            "семейные номера до 5 человек, отдельный детский ресторан."
        ),
        "highlights": [
            "Аквапарк 21 горка, два детских",
            "Family-номера для 2+2 без доплат",
            "Детский ресторан Mini Crystal",
            "Анимация на русском языке",
        ],
        "images": [
            "https://images.unsplash.com/photo-1559599189-fe84dea4eb79?auto=format&fit=crop&w=1600&q=80",
            "https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?auto=format&fit=crop&w=1600&q=80",
            "https://images.unsplash.com/photo-1455587734955-081b22074882?auto=format&fit=crop&w=1600&q=80",
        ],
        "rooms": "Family Room; Standard Room; Junior Suite",
        "services": "аквапарк 21 горка; 5 бассейнов; spa; теннис",
        "servicefree": "Wi-Fi; полотенца; детский клуб; вечерние шоу",
        "child": "клуб 4-12 и 13-17; детский ресторан; коляски в аренду",
        "beach": "150 м; песчаный; шезлонги; зонты",
        "mealtypes": "All Inclusive; детское меню; диетическое",
        "_warning": "Перед бронью проверьте наличие family-номера: спрос высокий.",
    },
    {
        "hotel_code": 700528,
        "hotel_name": "Voyage Belek Golf & Spa",
        "hotel_stars": 5,
        "hotel_rating": "4.7",
        "country": "Турция",
        "country_code": 4,
        "resort": "Белек",
        "region_code": 8,
        "price": 268000,
        "currency": "RUB",
        "nights": 7,
        "meal_code": "AI",
        "meal_description": "Всё включено",
        "room_type": "Standard Room",
        "placement": "2 взрослых",
        "operator": "Coral Travel",
        "image_url": "https://images.unsplash.com/photo-1552733407-5d5c46c3bb3b?auto=format&fit=crop&w=1400&q=80",
        "sea_distance": "1 линия",
        "tags": ["all_inclusive", "spa", "premium", "beach", "family"],
        "description": (
            "Сочетание AI и гольф-резидента у поля Carya. Аквапарк, спа, "
            "ресторан с Мишленовским шеф-поваром."
        ),
        "highlights": [
            "Гольф-поле Carya рядом",
            "Спа 1500 м²",
            "Аквапарк с 8 горками",
            "Авторская кухня",
        ],
        "images": [
            "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=1600&q=80",
            "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1600&q=80",
            "https://images.unsplash.com/photo-1496417263034-38ec4f0b665a?auto=format&fit=crop&w=1600&q=80",
        ],
        "rooms": "Standard Room; Suite; Family Suite",
        "services": "spa; аквапарк; фитнес; гольф; теннис",
        "servicefree": "Wi-Fi; пляжные полотенца; ужин à la carte",
        "child": "детский клуб 4-12; мини-клуб; коляски",
        "beach": "1 линия; 250 м; песчаный; шезлонги бесплатно",
        "mealtypes": "All Inclusive; à la carte; диетическое",
        "_warning": None,
    },
    {
        "hotel_code": 800118,
        "hotel_name": "Steigenberger Aldau Beach",
        "hotel_stars": 5,
        "hotel_rating": "4.7",
        "country": "Египет",
        "country_code": 1,
        "resort": "Хургада",
        "region_code": 12,
        "price": 178000,
        "currency": "RUB",
        "nights": 7,
        "meal_code": "AI",
        "meal_description": "Всё включено",
        "room_type": "Superior Room",
        "placement": "2 взрослых",
        "operator": "FUN&SUN",
        "image_url": "https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=1400&q=80",
        "sea_distance": "1 линия",
        "tags": ["all_inclusive", "egypt", "diving", "beach"],
        "description": (
            "Спокойный курортный отель в Хургаде с большим коралловым рифом, "
            "детским клубом и просторными бассейнами."
        ),
        "highlights": [
            "Коралловый риф у пляжа",
            "Дайвинг-центр PADI",
            "Детский бассейн и клуб",
            "Дневная и вечерняя анимация",
        ],
        "images": [
            "https://images.unsplash.com/photo-1531366936337-7c912a4589a7?auto=format&fit=crop&w=1600&q=80",
            "https://images.unsplash.com/photo-1542652694-40abf526446e?auto=format&fit=crop&w=1600&q=80",
            "https://images.unsplash.com/photo-1551918120-9739cb430c6d?auto=format&fit=crop&w=1600&q=80",
        ],
        "rooms": "Superior Room; Family Room; Suite",
        "services": "3 бассейна; spa; дайвинг-центр; фитнес",
        "servicefree": "Wi-Fi; пляжные полотенца; вечерняя анимация",
        "child": "детский клуб 4-12; мини-аквапарк; детское меню",
        "beach": "1 линия; 800 м; песчаный; коралловый риф",
        "mealtypes": "All Inclusive; à la carte; европейская и арабская кухня",
        "_warning": None,
    },
    {
        "hotel_code": 800221,
        "hotel_name": "Rixos Sharm El Sheikh",
        "hotel_stars": 5,
        "hotel_rating": "4.8",
        "country": "Египет",
        "country_code": 1,
        "resort": "Шарм-Эль-Шейх",
        "region_code": 14,
        "price": 195000,
        "currency": "RUB",
        "nights": 7,
        "meal_code": "UAI",
        "meal_description": "Ультра всё включено",
        "room_type": "Deluxe Sea View",
        "placement": "2 взрослых",
        "operator": "Anex Tour",
        "image_url": "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1400&q=80",
        "sea_distance": "1 линия, 200 м",
        "tags": ["adults_only", "ultra_all_inclusive", "egypt", "beach"],
        "description": (
            "Adults-only ультра all-inclusive в бухте Налема Бэй: "
            "тропические сады, лучшие коралловые рифы и приватные пляжи."
        ),
        "highlights": [
            "Adults only 16+",
            "Лучший хаус-риф Шарма",
            "Бесплатный а-ля-карт каждый день",
            "Премиум-алкоголь",
        ],
        "images": [
            "https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=1600&q=80",
            "https://images.unsplash.com/photo-1576675784201-0e142b423952?auto=format&fit=crop&w=1600&q=80",
            "https://images.unsplash.com/photo-1564501049412-61c2a3083791?auto=format&fit=crop&w=1600&q=80",
        ],
        "rooms": "Deluxe Sea View; Suite; Royal Suite",
        "services": "spa; 4 бассейна; яхт-клуб; дайвинг",
        "servicefree": "Wi-Fi; премиум алкоголь; вечерние шоу",
        "child": "16+ only",
        "beach": "1 линия; 250 м; песчаный; хаус-риф",
        "mealtypes": "Ultra All Inclusive; à la carte; премиум алкоголь",
        "_adults_only_warning": "Только для гостей 16+.",
    },
    {
        "hotel_code": 900401,
        "hotel_name": "Atlantis The Palm",
        "hotel_stars": 5,
        "hotel_rating": "4.7",
        "country": "ОАЭ",
        "country_code": 9,
        "resort": "Дубай",
        "region_code": 31,
        "price": 410000,
        "currency": "RUB",
        "nights": 7,
        "meal_code": "BB",
        "meal_description": "Завтраки",
        "room_type": "Ocean Room",
        "placement": "2 взрослых",
        "operator": "Coral Travel",
        "image_url": "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=1400&q=80",
        "sea_distance": "1 линия",
        "tags": ["luxury", "uae", "kids", "premium"],
        "description": (
            "Икона Дубая: аквапарк Aquaventure, океанариум Lost Chambers, "
            "и пляж 1.4 км. Идеально для премиум-клиента и семьи."
        ),
        "highlights": [
            "Аквапарк Aquaventure включён",
            "Океанариум Lost Chambers",
            "23 ресторана",
            "Подводный люкс Posidon Suite",
        ],
        "images": [
            "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=1600&q=80",
            "https://images.unsplash.com/photo-1580418827493-26ff5f3a067e?auto=format&fit=crop&w=1600&q=80",
            "https://images.unsplash.com/photo-1466353583601-826265eaa17c?auto=format&fit=crop&w=1600&q=80",
        ],
        "rooms": "Ocean Deluxe; Imperial Club; Underwater Suite",
        "services": "Aquaventure; Lost Chambers; spa; фитнес",
        "servicefree": "Wi-Fi; вход в аквапарк; пляжные полотенца",
        "child": "Kids Club 3-12; подростковый клуб; коляски",
        "beach": "1 линия; 1.4 км; песчаный; виды на Burj Al Arab",
        "mealtypes": "Завтраки; 23 ресторана; премиум алкоголь",
        "_warning": None,
    },
    {
        "hotel_code": 900512,
        "hotel_name": "Centara Grand Beach Phuket",
        "hotel_stars": 5,
        "hotel_rating": "4.6",
        "country": "Таиланд",
        "country_code": 2,
        "resort": "Пхукет, Карон",
        "region_code": 56,
        "price": 245000,
        "currency": "RUB",
        "nights": 8,
        "meal_code": "BB",
        "meal_description": "Завтраки",
        "room_type": "Deluxe Room",
        "placement": "2 взрослых",
        "operator": "Pegas Touristik",
        "image_url": "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1400&q=80",
        "sea_distance": "1 линия",
        "tags": ["asia", "kids", "luxury", "beach"],
        "description": (
            "Семейный курорт на пляже Карон с собственным аквапарком "
            "и бесплатным детским клубом E-Zone."
        ),
        "highlights": [
            "Собственный аквапарк",
            "Прямой выход на пляж Карон",
            "E-Zone Kids Club",
            "Собственный спа",
        ],
        "images": [
            "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1600&q=80",
            "https://images.unsplash.com/photo-1519046904884-53103b34b206?auto=format&fit=crop&w=1600&q=80",
            "https://images.unsplash.com/photo-1496417263034-38ec4f0b665a?auto=format&fit=crop&w=1600&q=80",
        ],
        "rooms": "Deluxe Room; Family Room; Pool Villa",
        "services": "аквапарк; spa; фитнес; теннис",
        "servicefree": "Wi-Fi; полотенца; шезлонги",
        "child": "клуб 4-11 и 12-17; мини-аквапарк",
        "beach": "1 линия; 600 м; песчаный; шезлонги",
        "mealtypes": "Завтраки; à la carte; тайская и европейская кухня",
        "_warning": None,
    },
]


COUNTRY_KEYWORDS: Dict[int, List[str]] = {
    # Use word stems so "Турцию", "турцией", "турции" all match.
    4: ["турц", "анталь", "анталия", "белек", "сиде", "кемер", "аланья", "antalya", "turkey", "turkish"],
    1: ["египет", "египт", "хургад", "шарм", "egypt", "sharm", "hurghada"],
    9: ["оаэ", "дуба", "абу", "uae", "dubai", "emirat"],
    2: ["таиланд", "пхукет", "паттайя", "thailand", "phuket"],
    15: ["кипр", "cyprus"],
    11: ["доминикан", "пунта", "dominican"],
}


def detect_country_code(text: str) -> int | None:
    lowered = text.lower()
    for code, keywords in COUNTRY_KEYWORDS.items():
        if any(keyword in lowered for keyword in keywords):
            return code
    return None


def filter_demo_hotels(
    *,
    country_code: int | None = None,
    max_price: int | None = None,
    min_stars: int | None = None,
    adults_only_ok: bool = True,
    family: bool = False,
    limit: int = 6,
) -> List[Dict[str, Any]]:
    items = list(DEMO_HOTELS)
    if country_code:
        filtered = [h for h in items if h["country_code"] == country_code]
        if filtered:
            items = filtered
    if min_stars:
        items = [h for h in items if h["hotel_stars"] >= min_stars]
    if max_price:
        items = [h for h in items if h["price"] <= max_price]
    if family:
        items = [h for h in items if "family" in h["tags"] or "kids" in h["tags"]]
    if not adults_only_ok:
        items = [h for h in items if "adults_only" not in h["tags"]]
    items.sort(key=lambda h: h["price"])
    return items[: max(1, limit)]


def demo_hotel_to_card(hotel: Dict[str, Any], position: int) -> Dict[str, Any]:
    from datetime import datetime, timedelta

    base_date = datetime.now() + timedelta(days=21)
    date_from = base_date.strftime("%d.%m.%Y")
    date_to = (base_date + timedelta(days=hotel["nights"])).strftime("%d.%m.%Y")
    return {
        "hotel_name": hotel["hotel_name"],
        "hotel_stars": hotel["hotel_stars"],
        "hotel_rating": hotel["hotel_rating"],
        "country": hotel["country"],
        "resort": hotel["resort"],
        "price": hotel["price"],
        "currency": hotel["currency"],
        "date_from": date_from,
        "date_to": date_to,
        "nights": hotel["nights"],
        "meal_code": hotel["meal_code"],
        "meal_description": hotel["meal_description"],
        "room_type": hotel.get("room_type"),
        "placement": hotel.get("placement"),
        "adults": 2,
        "children": 1 if "family" in hotel.get("tags", []) else 0,
        "departure_city": "Москва",
        "operator": hotel["operator"],
        "flight_included": True,
        "tour_id": f"demo-{hotel['hotel_code']}-{position}",
        "hotel_code": hotel["hotel_code"],
        "hotel_link": None,
        "image_url": hotel["image_url"],
        "sea_distance": hotel.get("sea_distance"),
        "on_request": False,
        "flight_status": 0,
        "hotel_status": 2,
        "night_flight": 0,
        "promo": "premium" in hotel.get("tags", []),
        "is_hot_tour": False,
        "_position": position,
        "_warning": hotel.get("_warning"),
        "_adults_only_warning": hotel.get("_adults_only_warning"),
    }


def demo_hotel_to_info(hotel: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "name": hotel["hotel_name"],
        "stars": hotel["hotel_stars"],
        "rating": hotel["hotel_rating"],
        "country": hotel["country"],
        "region": hotel["resort"],
        "seadistance": hotel.get("sea_distance", ""),
        "build": "",
        "repair": "",
        "square": "",
        "phone": "",
        "site": "",
        "placement": hotel.get("placement", ""),
        "description": hotel["description"],
        "territory": "обширная зелёная территория с прудами и аллеями",
        "beach": hotel.get("beach", ""),
        "child": hotel.get("child", ""),
        "inroom": "Wi-Fi; кондиционер; сейф; мини-бар; ТВ; балкон",
        "roomtypes": hotel.get("rooms", ""),
        "services": hotel.get("services", ""),
        "servicefree": hotel.get("servicefree", ""),
        "servicepay": "массаж; рент-кар; экскурсии",
        "meallist": hotel.get("meal_description", ""),
        "mealtypes": hotel.get("mealtypes", ""),
        "animation": "профессиональная анимация; вечерние шоу; spa-программы",
        "images": hotel.get("images", []),
        "images_count": len(hotel.get("images", [])),
        "coordinates": {"lat": "", "lon": ""},
        "reviews": [
            {
                "name": "Анна",
                "rate": 5.0,
                "content": "Прекрасный отдых, отель полностью оправдал ожидания клиента!",
                "traveltime": "июнь 2024",
            },
            {
                "name": "Олег",
                "rate": 4.5,
                "content": "Ездили семьёй, дети в восторге от аквапарка и анимации.",
                "traveltime": "август 2024",
            },
        ],
        "reviews_count": 2,
    }


def demo_flight_option(card: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "flights": [
            {
                "forward": [
                    {
                        "number": "TK-415",
                        "airline": "Turkish Airlines",
                        "airline_logo": "",
                        "departure_date": card["date_from"],
                        "departure_time": "06:30",
                        "departure_airport": "Шереметьево",
                        "departure_airport_code": "SVO",
                        "arrival_date": card["date_from"],
                        "arrival_time": "09:50",
                        "arrival_airport": "Анталия",
                        "arrival_airport_code": "AYT",
                        "flight_class": "Y",
                        "baggage": "23 кг",
                        "on_demand": False,
                    }
                ],
                "backward": [
                    {
                        "number": "TK-414",
                        "airline": "Turkish Airlines",
                        "airline_logo": "",
                        "departure_date": card["date_to"],
                        "departure_time": "11:00",
                        "departure_airport": "Анталия",
                        "departure_airport_code": "AYT",
                        "arrival_date": card["date_to"],
                        "arrival_time": "14:20",
                        "arrival_airport": "Шереметьево",
                        "arrival_airport_code": "SVO",
                        "flight_class": "Y",
                        "baggage": "23 кг",
                        "on_demand": False,
                    }
                ],
                "date_forward": card["date_from"],
                "date_backward": card["date_to"],
                "price": card["price"],
                "currency": card.get("currency", "RUB"),
                "is_default": True,
            }
        ]
    }
