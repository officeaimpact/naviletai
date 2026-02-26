# БЭКЕНД AI-ТУРМЕНЕДЖЕРА — ПОЛНОЕ ОПИСАНИЕ МЕХАНИЗМА

> Этот документ описывает КАК работает бэкенд, ЧТО он принимает и отдаёт, и из КАКИХ файлов состоит. Документ предназначен для подключения бэкенда к новому фронтенду.

---

## 1. ФАЙЛЫ БЭКЕНДА

### Обязательные — 7 файлов + .env

```
backend/
├── app.py                    # Flask-сервер, все API-эндпоинты, сессии, логирование
├── tourvisor_client.py       # Async HTTP-клиент для TourVisor API (поиск туров, отели, справочники)
├── yandex_handler.py         # Yandex GPT обработчик + ВСЯ бизнес-логика (dispatch, tour_cards, валидация, safety-nets) — ~4600 строк
├── openai_handler.py         # OpenAI GPT обработчик — наследует бизнес-логику из yandex_handler, переопределяет только общение с LLM
├── requirements.txt          # Python-зависимости: httpx, python-dotenv, openai, requests, flask, flask-cors
└── .env                      # API-ключи (не коммитить!)

# В КОРНЕ проекта (на один уровень выше backend/):
function_schemas.json         # JSON-схемы 8 функций, которые AI может вызывать
system_prompt.md              # Системный промпт AI — 538 строк правил поведения, каскад, справочники кодов
```

**Важно:** `function_schemas.json` и `system_prompt.md` должны лежать в корне проекта (родительская папка относительно `backend/`). Обработчики ищут их по пути `../function_schemas.json` и `../system_prompt.md`.

### Рекомендуемые — документация

```
functions_logic.md                  # Подробная документация TourVisor API + бизнес-логика (1485 строк)
Tourvisour_documentation/README.md  # Оригинальная документация TourVisor
```

### Переменные окружения (`backend/.env`)

```env
# Выбор LLM
LLM_PROVIDER=openai              # "openai" или "yandex"

# OpenAI (если LLM_PROVIDER=openai)
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
# OPENAI_BASE_URL=https://...    # опционально: прокси

# Yandex GPT (если LLM_PROVIDER=yandex)
# YANDEX_FOLDER_ID=b1g...
# YANDEX_API_KEY=AQV...
# YANDEX_MODEL=yandexgpt

# TourVisor API (ОБЯЗАТЕЛЬНО)
TOURVISOR_AUTH_LOGIN=...
TOURVISOR_AUTH_PASS=...
TOURVISOR_BASE_URL=https://tourvisor.ru/xml

# Логирование
LOG_LEVEL=INFO
```

---

## 2. ОБЩАЯ АРХИТЕКТУРА — КАК ВСЁ СВЯЗАНО

```
ФРОНТЕНД  ──POST /api/v1/chat──►  app.py (Flask)
                                      │
                                      │ Находит/создаёт handler для session_id
                                      │ Вызывает handler.chat(message)
                                      ▼
                                 openai_handler.py / yandex_handler.py
                                      │
                                      │ Формирует промпт + историю
                                      │ Отправляет в LLM (OpenAI / Yandex GPT)
                                      │ LLM возвращает tool_calls или текст
                                      │
                                      │◄── цикл до 20 итераций ──►│
                                      │                            │
                                      ▼                            │
                              _dispatch_function()                 │
                                      │                            │
                                      │ Валидирует аргументы       │
                                      │ Вызывает TourVisor API     │
                                      │ Формирует tour_cards       │
                                      ▼                            │
                              tourvisor_client.py ──HTTPS──► tourvisor.ru/xml
                                      │                            │
                                      │ Результат → обратно в LLM ─┘
                                      │
                                      ▼
                                 Финальный текст + tour_cards
                                      │
ФРОНТЕНД  ◄──JSON { reply, tour_cards, conversation_id }──  app.py
```

### Суть механизма

1. Фронтенд отправляет текст пользователя в `POST /api/v1/chat`
2. `app.py` передаёт сообщение в AI-обработчик
3. AI-обработчик отправляет промпт + историю в LLM (OpenAI GPT или Yandex GPT)
4. LLM либо отвечает текстом, либо вызывает функции (tool_calls)
5. Если tool_calls — обработчик выполняет функции через TourVisor API, возвращает результат обратно в LLM
6. Цикл повторяется (до 20 итераций), пока LLM не даст финальный текстовый ответ
7. За время цикла формируются `tour_cards` — структурированные карточки туров
8. `app.py` возвращает `{ reply, tour_cards, conversation_id }` фронтенду

---

## 3. API-КОНТРАКТ — ЧТО ПРИНИМАЕТ И ОТДАЁТ БЭКЕНД

### Основной эндпоинт: `POST /api/v1/chat`

**Запрос:**
```json
{
  "message": "Хочу в Турцию из Москвы, вдвоём, в начале марта на неделю, 5 звёзд, всё включено",
  "conversation_id": "550e8400-e29b-41d4-a716-446655440000"
}
```
- `message` — текст пользователя (обязательный)
- `conversation_id` — UUID сессии. Если не передан — сервер сгенерирует новый. Чтобы продолжить диалог — передавай тот же ID

**Успешный ответ (200):**
```json
{
  "reply": "Нашёл отличные варианты 5-звёздочных отелей в Турции с All Inclusive! Посмотрите подборку и скажите, какой заинтересовал — расскажу подробнее.",
  "tour_cards": [
    {
      "hotel_name": "Rixos Premium Belek",
      "hotel_stars": 5,
      "hotel_rating": "4.8",
      "country": "Турция",
      "resort": "Белек",
      "price": 285000,
      "price_per_person": false,
      "currency": "RUB",
      "date_from": "01.03.2026",
      "date_to": "08.03.2026",
      "nights": 7,
      "meal_code": "uai",
      "meal_description": "Ультра всё включено",
      "room_type": "Standard Room",
      "placement": "DBL",
      "adults": 2,
      "children": 0,
      "departure_city": "Москва",
      "operator": "Anex Tour",
      "flight_included": true,
      "tour_id": "6460945121",
      "hotel_code": 12345,
      "hotel_link": "https://tourvisor.ru/hotel/...",
      "sea_distance": "150м",
      "on_request": false,
      "flight_status": 0,
      "hotel_status": 2,
      "night_flight": 0,
      "promo": false,
      "is_hot_tour": false,
      "old_price": null,
      "discount_percent": null,
      "_position": 1,
      "_warning": null,
      "_adults_only_warning": null
    }
  ],
  "conversation_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Когда `tour_cards` пустой:** AI задаёт уточняющие вопросы, консультирует, отвечает на вопросы — без карточек.

**Когда `tour_cards` заполнен:** AI нашёл туры — текст `reply` содержит краткое описание ("Нашёл варианты..."), а карточки — в массиве.

**Ошибка (500):**
```json
{
  "error": "описание",
  "reply": "Извините, произошла техническая ошибка. Попробуйте ещё раз.",
  "tour_cards": [],
  "conversation_id": "..."
}
```

### Вспомогательные эндпоинты

| Метод | URL | Что делает |
|-------|-----|-----------|
| `POST` | `/api/reset` | Сбрасывает историю диалога. Тело: `{ "session_id": "uuid" }` |
| `GET` | `/api/status` | Статус сервера: `{ "status": "running", "sessions": 3 }` |
| `GET` | `/api/metrics` | Агрегированные метрики по всем сессиям |

### CORS

Настроен через `flask-cors` — по умолчанию принимает запросы с любого origin.

### Время ответа

- Простой вопрос/уточнение: 1-5 секунд
- Поиск туров: 10-30 секунд (TourVisor API асинхронный, ждёт операторов)
- Сложный запрос (сравнение стран, несколько поисков): до 60 секунд

---

## 4. ПОЛЯ TOUR_CARDS — ПОДРОБНОЕ ОПИСАНИЕ

### Основные поля

| Поле | Тип | Описание |
|------|-----|----------|
| `hotel_name` | string | Название отеля |
| `hotel_stars` | int | Звёздность (1-5) |
| `hotel_rating` | string | Рейтинг отеля (например "4.5") |
| `country` | string | Страна |
| `resort` | string | Курорт/регион |
| `price` | int | Цена в рублях |
| `price_per_person` | bool | **Критично!** `false` = цена за номер (обычный поиск), `true` = цена за человека (горящие туры) |
| `currency` | string | Валюта ("RUB") |
| `date_from` | string | Дата вылета (ДД.ММ.ГГГГ) |
| `date_to` | string | Дата возвращения (ДД.ММ.ГГГГ) |
| `nights` | int | Количество ночей |
| `meal_code` | string | Код питания (ro/bb/hb/fb/ai/uai) |
| `meal_description` | string | Питание текстом ("Всё включено") |
| `room_type` | string | Тип номера ("Standard Room") |
| `placement` | string | Размещение ("DBL", "SGL", "TRPL") |
| `adults` | int | Взрослых |
| `children` | int | Детей |
| `departure_city` | string | Город вылета |
| `operator` | string | Туроператор |
| `flight_included` | bool | Перелёт включён |
| `tour_id` | string | ID тура — для актуализации/бронирования. Живёт ~24 часа |
| `hotel_code` | int | Код отеля — постоянный, для запроса инфо об отеле |
| `hotel_link` | string | Ссылка на страницу отеля |
| `sea_distance` | string | Расстояние до моря |

### Статусы и предупреждения

| Поле | Тип | Значения | Что показывать |
|------|-----|----------|---------------|
| `on_request` | bool | true/false | `true` → "Тур под запрос" |
| `flight_status` | int | 0/1/2 | 0=ок, 1="Рейс под запрос", 2="Мало мест на рейсе!" |
| `hotel_status` | int | 0/1/2 | 0=ок, 1="Под запрос", 2="Мгновенное подтверждение" |
| `night_flight` | int | 0/N | >0 → "Ночной перелёт" |
| `promo` | bool | true/false | `true` → "Промо-цена" |

### Горящие туры (когда `is_hot_tour: true`)

| Поле | Тип | Описание |
|------|-----|----------|
| `is_hot_tour` | bool | `true` = горящий тур |
| `old_price` | int/null | Старая цена (до скидки) |
| `discount_percent` | float/null | Процент скидки |
| `price_per_person` | bool | Всегда `true` для горящих — цена ЗА ЧЕЛОВЕКА |

### Служебные поля

| Поле | Тип | Описание |
|------|-----|----------|
| `_position` | int | Позиция в выдаче (1, 2, 3...) |
| `_warning` | string/null | Текстовое предупреждение (если есть) |
| `_adults_only_warning` | string/null | Предупреждение "Только для взрослых" |

---

## 5. КАК РАБОТАЕТ БЭКЕНД ВНУТРИ — ПОЛНЫЙ ЦИКЛ

### 5.1. Что происходит при получении сообщения

```
POST /api/v1/chat  { message: "Хочу в Турцию", conversation_id: "abc" }
```

1. **app.py** получает запрос
2. Ищет handler для session_id="abc" (или создаёт новый)
3. Вызывает `handler.chat("Хочу в Турцию")` — это async-функция, запускается через `asyncio.new_event_loop()`

### 5.2. Что делает handler.chat()

Это **итеративный цикл** (до 20 итераций):

```
Итерация 1:
  → Отправляет system_prompt + full_history + user_message в LLM
  ← LLM отвечает: "Из какого города планируете вылетать?"
  → Это финальный текст → выход из цикла
  → Возврат: { reply: "Из какого города...", tour_cards: [] }
```

Клиент отвечает "Москва, в начале марта, вдвоём, 5 звёзд, всё включено":

```
Итерация 1:
  → system_prompt + history + новое сообщение → LLM
  ← LLM решает вызвать get_current_date() → tool_call
  → Handler вызывает _dispatch_function("get_current_date") → {date: "23.02.2026"}
  → Результат записывается в историю → LLM видит дату

Итерация 2:
  → LLM вызывает search_tours({departure:1, country:4, datefrom:"01.03.2026", ...})
  → _dispatch_function("search_tours"):
      - Валидирует departure (совпадает с "Москва" в тексте? Да → ок)
      - Корректирует dateto (модель не ошиблась? Проверка)
      - Вызывает tourvisor_client.search_tours() → requestid="ABC123"
      - Сохраняет requestid в кэш
  → Результат: {requestid: "ABC123"}

Итерация 3:
  → LLM вызывает get_search_status({requestid: "ABC123"})
  → _dispatch_function("get_search_status"):
      - Вызывает tourvisor_client.wait_for_search() — ждёт до 60 сек
      - Early return когда ≥5 отелей и прогресс ≥50%
  → Результат: {state: "finished", hotelsfound: 15, toursfound: 87}

Итерация 4:
  → LLM вызывает get_search_results({requestid: "ABC123"})
  → _dispatch_function("get_search_results"):
      - Вызывает tourvisor_client.get_search_results()
      - Получает массив отелей с турами
      - ★ ФОРМИРУЕТ tour_cards ★ — маппит каждый отель в структурированную карточку
      - Сохраняет карточки в self._pending_tour_cards
      - Сохраняет tourid каждого отеля в self._tourid_map
  → Результат (для LLM): сжатые данные отелей

Итерация 5:
  → LLM видит данные → генерирует текст:
    "Нашёл отличные варианты 5-звёздочных отелей..."
  → Это финальный текст → Safety-net проверки → выход из цикла
```

Результат:
```json
{
  "reply": "Нашёл отличные варианты...",
  "tour_cards": [... 5-10 карточек ...],
  "conversation_id": "abc"
}
```

### 5.3. Что такое _dispatch_function

Это маршрутизатор — получает имя функции и аргументы от LLM, выполняет действие:

| Функция LLM | Что делает _dispatch_function |
|-------------|------------------------------|
| `get_current_date()` | Возвращает текущую дату/время |
| `search_tours({...})` | Валидирует параметры + вызывает tourvisor_client.search_tours() → requestid |
| `get_search_status({requestid})` | Вызывает wait_for_search() — ждёт завершения поиска |
| `get_search_results({requestid})` | Получает результаты + **формирует tour_cards** |
| `get_dictionaries({type})` | Справочники: страны, города, курорты, питание, отели |
| `actualize_tour({tourid})` | Актуализация цены конкретного тура |
| `get_tour_details({tourid})` | Детали: рейсы, доплаты, состав тура |
| `get_hotel_info({hotelcode})` | Информация об отеле: описание, пляж, дети, номера, отзывы |
| `get_hot_tours({city, items})` | Горящие туры + **формирует tour_cards** |
| `continue_search({requestid})` | Продолжение поиска ("ещё варианты") |

### 5.4. Каскад сбора информации

AI НЕ вызывает поиск, пока не соберёт 5 обязательных слотов:

```
Слот 1: Направление      → страна, курорт, конкретный отель
Слот 2: Город вылета      → откуда летит клиент
Слот 3: Даты / длительность → когда, на сколько ночей
Слот 4: Состав            → взрослые, дети, возраст детей
Слот 5: Quality Check     → звёзды, питание
```

Пока не все слоты заполнены — AI задаёт уточняющие вопросы (в `reply`, без `tour_cards`). Когда все собраны — вызывает `search_tours`.

**Исключение:** Горящие туры (`get_hot_tours`) требуют ТОЛЬКО город вылета.

### 5.5. Сессии и память

Каждый `conversation_id` — отдельная сессия. Handler хранит между сообщениями:

| Что хранит | Зачем |
|-----------|-------|
| `full_history` | История диалога (до 30 сообщений) — контекст для LLM |
| `_pending_tour_cards` | Карточки текущего ответа |
| `_last_requestid` | Последний requestid (для "покажи ещё" → continue_search) |
| `_tourid_map` | Позиция → tourid ("третий вариант" → конкретный tour_id) |
| `_last_search_params` | Кэш последнего поиска (при смене страны — параметры не теряются) |
| `_last_departure_city` | Город вылета для карточек |

Сессия живёт **30 минут** неактивности, потом удаляется автоматически.

---

## 6. TOURVISOR API — КАК БЭКЕНД ИЩЕТ ТУРЫ

### Что такое TourVisor

Внешний API (`tourvisor.ru/xml`) — агрегатор туроператоров. Бэкенд через него ищет туры, получает цены, информацию об отелях.

### 7 эндпоинтов

| Endpoint | Что делает |
|----------|-----------|
| `search.php` | Запускает поиск → возвращает `requestid` (мгновенно) |
| `result.php` | Результаты/статус поиска по `requestid` |
| `list.php` | Справочники: 11 типов (страны, города, курорты, питание, отели, операторы...) |
| `actualize.php` | Актуализация цены конкретного тура |
| `actdetail.php` | Детали: авиарейсы, доплаты, состав тура |
| `hotel.php` | Полная информация об отеле |
| `hottours.php` | Горящие туры |

### Асинхронный поиск

Поиск туров — НЕ мгновенный. TourVisor опрашивает десятки туроператоров:

```
1. search.php → requestid (мгновенно)
2. result.php?type=status → state=searching, progress=30%, hotelsfound=3
3. result.php?type=status → state=searching, progress=65%, hotelsfound=12
4. result.php?type=result → [{hotel1}, {hotel2}, ...] (когда готово)
```

Бэкенд автоматически ждёт (функция `wait_for_search`), с оптимизацией: возвращает результат раньше, когда найдено ≥5 отелей и прогресс ≥50%.

### Ключевые особенности

- **Цены search_tours:** ЗА НОМЕР (за весь состав)
- **Цены hot_tours:** ЗА ЧЕЛОВЕКА — для пары нужно ×2
- **tourid:** живёт ~24 часа, потом нужен новый поиск
- **hotelcode:** постоянный ID отеля
- **Формат дат:** ДД.ММ.ГГГГ
- **Макс. диапазон дат:** 14 дней
- **Ошибки API:** приходят с HTTP 200, парсятся из JSON

---

## 7. SAFETY-NET — ЗАЩИТНЫЕ МЕХАНИЗМЫ

Бэкенд содержит ~15 защит от ошибок LLM и API:

### При поиске туров (в _dispatch_function)

| Механизм | Что предотвращает |
|----------|------------------|
| Departure validation | Модель передала неправильный код города → авто-исправление по тексту пользователя |
| Date auto-year | DD.MM без года → авто-дополнение текущим годом |
| Dateto clamp | Модель перепутала дату возвращения с последней датой вылета → коррекция |
| Past date fix | Даты в прошлом → сдвиг на завтра |
| Month part correction | "в конце мая" → правильный диапазон 20.05-31.05 (а не точная дата) |
| Region auto-resolve | Клиент сказал курорт, модель не передала regions → авто-определение через hardcoded ID или API |
| Country mismatch fix | Курорт привязан к конкретной стране → авто-коррекция country |
| Parameter cache | При смене направления ("а если Египет?") → остальные параметры из кэша |
| Hallucination sanitize | Модель вставила вызов функции внутрь аргумента → удаление |
| Cascade slot check | Блокировка поиска если не все 5 слотов заполнены |

### При генерации ответа (в chat loop)

| Механизм | Что предотвращает |
|----------|------------------|
| Promised search detection | Модель написала "Сейчас поищу" вместо вызова функции → принудительный вызов |
| Pipeline break detection | search_tours вернул requestid, но модель не вызвала get_search_results → принудительный вызов |
| Result leak filter | Модель показала сырые данные JSON вместо текста → перегенерация |
| Response deduplication | Повторяющиеся абзацы/предложения → удаление |
| Reasoning leak strip | Утечки внутренних рассуждений LLM → удаление |
| Function name strip | Имена функций в тексте ответа → удаление |
| Trailing fragment strip | Обрезка незаконченного текста |

---

## 8. ФУНКЦИИ AI — ПОЛНЫЙ СПИСОК

AI может вызывать эти функции (описаны в `function_schemas.json`):

### 8.1 get_current_date
Возвращает текущую дату. AI вызывает ПЕРЕД поиском чтобы корректно сформировать даты.

### 8.2 search_tours
Запускает поиск туров. Основные параметры:

| Параметр | Тип | Обязательный | Описание |
|----------|-----|-------------|----------|
| `departure` | int | Да | Код города вылета (1=Москва, 5=СПб, ...) |
| `country` | int | Да | Код страны (4=Турция, 1=Египет, 9=ОАЭ, ...) |
| `datefrom` | string | Нет | Начало диапазона дат (ДД.ММ.ГГГГ) |
| `dateto` | string | Нет | Конец диапазона дат |
| `nightsfrom` | int | Нет | Мин. ночей (по умолч. 7) |
| `nightsto` | int | Нет | Макс. ночей (по умолч. 10) |
| `adults` | int | Нет | Взрослых (по умолч. 2) |
| `child` | int | Нет | Детей (0-3) |
| `stars` | int | Нет | Мин. звёздность (2-5) |
| `meal` | int | Нет | Код питания (7=AI, 3=BB, 4=HB, ...) |
| `regions` | string | Нет | Коды курортов через запятую |
| `hotels` | string | Нет | Коды конкретных отелей |
| `pricefrom` | int | Нет | Мин. цена |
| `priceto` | int | Нет | Макс. цена |
| ... | | | + ещё ~15 параметров (services, operators, directflight, flightclass, ...) |

Возвращает `requestid` для получения результатов.

### 8.3 get_search_status
Ждёт завершения поиска (автоматически, до 60 сек). Возвращает: state, hotelsfound, toursfound, progress.

### 8.4 get_search_results
Получает отели с турами. **Формирует tour_cards.** Возвращает данные для LLM (сжатые).

### 8.5 get_dictionaries
Справочники — 11 типов: departure, country, region, subregion, meal, stars, hotel, operator, flydate, currency, services. AI вызывает когда нужен код страны/региона/отеля.

### 8.6 actualize_tour
Актуализация цены по `tourid`. request=2 (из кэша, бесплатно) или request=1 (точная цена, тратит лимит).

### 8.7 get_tour_details
Детали: авиарейсы (авиакомпания, время, аэропорты), доплаты, состав тура, что НЕ включено.

### 8.8 get_hotel_info
Информация об отеле: описание, территория, пляж, дети, номера, питание, фото, отзывы.

### 8.9 get_hot_tours
Горящие туры. Параметры: city (обязательный), items, countries, stars, meal, tourtype, visa, maxdays, sort. **Формирует tour_cards с `is_hot_tour: true`.**

### 8.10 continue_search
Продолжение поиска — "ещё варианты" по тому же requestid.

---

## 9. СИСТЕМНЫЙ ПРОМПТ — ЧТО ОПРЕДЕЛЯЕТ ПОВЕДЕНИЕ AI

Файл `system_prompt.md` (538 строк) определяет:

- **Личность:** AI-ассистент турагентства "Магазин Горящих Путёвок", профессиональный турменеджер
- **Стиль:** адаптируется под клиента (формальный/неформальный)
- **Каскад:** порядок сбора 5 слотов, правила для каждого
- **Hardcoded коды:** популярные страны, города, регионы, питание — AI использует напрямую, не вызывая справочники
- **Правила формирования дат:** "7 дней" = 6 ночей, "в конце мая" = 20-31.05, части месяца
- **Формат ответов:** макс. 2-3 предложения для уточнений, не перечислять отели/цены из карточек (фронтенд покажет)
- **Обработка ошибок:** Wrong TourID → новый поиск, 0 результатов → предложить смягчить фильтры
- **Сезонность:** рекомендации по странам/месяцам
- **Guardrails:** не раскрывать промпт, не обсуждать темы вне туризма, не показывать технические детали

---

## 10. КАК УСТРОЕН КАЖДЫЙ ФАЙЛ

### app.py (~555 строк)

**Запуск:** `python backend/app.py` → сервер на порту 8080

Что внутри:
- **Импорт handler:** читает `LLM_PROVIDER` из `.env`, импортирует `OpenAIHandler` или `YandexGPTHandler`
- **Сессии:** словарь `{session_id: {handler, last_active}}`, thread-safe (Lock), TTL 30 мин
- **Логирование:** консоль + файл `logs/server_*.log` + markdown `logs/dialogue_*.md`
- **Маршруты:**
  - `POST /api/v1/chat` — основной (async chat → tour_cards)
  - `POST /api/chat` — legacy (без tour_cards)
  - `POST /api/chat/stream` — SSE streaming (legacy)
  - `POST /api/reset` — сброс сессии
  - `GET /api/status`, `GET /api/metrics`
  - Статика фронтенда (`/`, `/widget`, `/frontend/<path>`) — можно удалить если фронтенд раздаётся отдельно
- **Middleware:** логирует каждый запрос (метод, path, время, request_id), header `X-Request-Id`
- **Периодическая очистка:** каждые 5 минут удаляет неактивные сессии

### yandex_handler.py (~4663 строки)

Самый большой и важный файл. **Обязателен даже при использовании OpenAI** — содержит всю бизнес-логику.

Что внутри:
- **Класс `YandexGPTHandler`:**
  - `__init__()` — TourVisor клиент, tools из function_schemas.json, system_prompt, история, кэши, метрики
  - `chat(message)` — основной цикл (отправка в Yandex GPT → обработка tool_calls → итерации)
  - `chat_stream(message, on_token)` — streaming версия
  - `_execute_function(name, args, call_id)` — обёртка: JSON-парсинг → dispatch → форматирование
  - `_dispatch_function(name, args)` — **~1200 строк** — маршрутизация всех функций, вся валидация, формирование tour_cards

- **Safety-net функции (вне класса):**
  - `_is_promised_search()`, `_dedup_response()`, `_strip_reasoning_leak()`, `_dedup_sentences()`, `_check_cascade_slots()`, `_fuzzy_hotel_match()`, и другие

- **Формирование tour_cards:**
  - При `get_search_results`: каждый отель маппится в карточку
  - При `get_hot_tours`: каждый горящий тур маппится в карточку с `is_hot_tour: true`
  - Карточки складываются в `self._pending_tour_cards`

### openai_handler.py (~740 строк)

Наследует `YandexGPTHandler`. Переопределяет ТОЛЬКО взаимодействие с LLM:

- `__init__()` — OpenAI SDK вместо HTTP к Yandex
- `chat()` — нативные `tool_calls` вместо plaintext regex parsing
- `_build_openai_messages()` — формат messages для OpenAI
- `_build_openai_tools()` — конвертация function_schemas в формат OpenAI
- `_trim_history()` — обрезка с сохранением tool_call/tool_result пар
- Параллельное выполнение нескольких tool_calls через `asyncio.gather`
- Обработка: rate limits, context length, content filter, geo-blocking, timeout

Вся бизнес-логика (`_dispatch_function`, tour_cards, валидация) — из yandex_handler.

### tourvisor_client.py (~777 строк)

Async HTTP-клиент для TourVisor API:

- `_request(endpoint, params)` — базовый GET с авторизацией, логами, retry (2 попытки для actualize/actdetail), таймаут 30 сек
- Каждый метод API = отдельный метод класса
- **Ошибки TourVisor приходят с HTTP 200** — клиент парсит JSON: errormessage, success=0, state="no search results"
- Кастомные исключения: `TourIdExpiredError`, `SearchNotFoundError`, `NoResultsError`
- `wait_for_search()` — поллинг каждые 1 сек, early return при ≥5 отелей + ≥50% прогресса, макс. 30 сек

### function_schemas.json (~510 строк)

JSON-массив из 8 функций. Для каждой: name, description, parameters (type, description, required, enum, default). Используется обоими handler'ами для передачи в LLM.

### system_prompt.md (~538 строк)

Текстовый промпт на русском. Загружается один раз при создании handler'а. Отправляется в каждом запросе к LLM как system message.

---

## 11. ЗАПУСК

```bash
cd backend
pip install -r requirements.txt
# Создать .env (см. раздел 1)
python app.py
# → Сервер на http://localhost:8080
```

Проверка:
```bash
curl http://localhost:8080/api/status
# → {"sessions": 0, "status": "running"}
```
