"""Tourvisor AI Copilot demo backend.

Real OpenAI/OpenRouter agent with TourVisor function calling.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import time
import uuid
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any, Awaitable, Callable, Dict, List, Optional, Tuple

from dotenv import load_dotenv
from flask import Flask, Response, jsonify, request
from flask_cors import CORS
from html import escape as html_escape

try:
    from .tourvisor_client import (
        NoResultsError,
        SearchNotFoundError,
        TourIdExpiredError,
        TourVisorAPIError,
        TourVisorClient,
        TourVisorError,
    )
    from .demo_data import (
        DEMO_HOTELS,
        demo_flight_option,
        demo_hotel_to_card,
        demo_hotel_to_info,
        detect_country_code,
        filter_demo_hotels,
    )
except ImportError:
    from tourvisor_client import (
        NoResultsError,
        SearchNotFoundError,
        TourIdExpiredError,
        TourVisorAPIError,
        TourVisorClient,
        TourVisorError,
    )
    from demo_data import (
        DEMO_HOTELS,
        demo_flight_option,
        demo_hotel_to_card,
        demo_hotel_to_info,
        detect_country_code,
        filter_demo_hotels,
    )

load_dotenv(Path(__file__).resolve().parent / ".env")
load_dotenv()

logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))
logger = logging.getLogger("copilot")

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})

BACKEND_DIR = Path(__file__).resolve().parent
SYSTEM_PROMPT_PATH = BACKEND_DIR / "prompts" / "system_prompt_agent_copilot.md"
FUNCTION_SCHEMAS_PATH = BACKEND_DIR / "function_schemas_agent.json"

AGENT_TOOLS = {
    "get_current_date",
    "get_dictionaries",
    "search_tours",
    "get_search_results",
    "get_hotel_info",
    "get_hot_tours",
    "continue_search",
    # Агентские инструменты §7.5.9 / §7.5.10 / §7.5.12:
    "get_tour_details",
    "actualize_tour",
    "build_collection",
}

DEFAULT_MODEL = os.getenv("OPENAI_MODEL", "openai/gpt-4o-mini")
MAX_AGENT_STEPS = int(os.getenv("AGENT_MAX_STEPS", "10"))


# ────────────────────────────────────────────────────────────────────
# Sessions
# ────────────────────────────────────────────────────────────────────


class CopilotSession:
    """Per-conversation state.

    Карточки делятся на два слоя:
    - last_cards / last_hotels / last_search_request_id  — долговременная память сессии
      (нужна, чтобы обрабатывать follow-up «дай 3 премиум из этой выдачи» / «WhatsApp по топ-3»);
    - turn_pending_cards / turn_intent / last_cascade_missing — состояние ТЕКУЩЕГО хода,
      сбрасывается на каждом новом сообщении пользователя. Только turn_pending_cards уходят
      в API-ответ как `tour_cards`, чтобы UI не дублировал старую выдачу.

    collected_slots — слоты каскада, выцепленные регулярками из истории сообщений (как в
    mgp_v2 OpenAIHandler._collected_slots). Помогают и LLM, и backend gate понимать, что
    клиент уже сказал.
    """

    def __init__(self, conversation_id: str) -> None:
        self.id = conversation_id
        self.history: List[Dict[str, Any]] = []
        self.last_search_request_id: Optional[str] = None
        self.last_search_params: Dict[str, Any] = {}
        self.last_hotels: List[Dict[str, Any]] = []
        self.last_cards: List[Dict[str, Any]] = []
        # Per-turn state (сбрасывается на каждый новый user message)
        self.turn_pending_cards: List[Dict[str, Any]] = []
        self.turn_intent: Optional[str] = None
        self.last_cascade_missing: Optional[str] = None
        self.last_cascade_nudge: Optional[str] = None
        self.allow_service_ids_this_turn: bool = False
        # Slot tracker (per-session, переживает компакт истории)
        self.collected_slots: Dict[str, str] = {}
        # Лёгкий профиль клиента (свободный текст, до 200 символов).
        # Накапливается между ходами; влияет на сравнения, флаги и сценарные ответы.
        self.client_profile: Optional[str] = None
        # Один раз за сессию ассистент может проактивно предложить уточнить профиль
        # (см. system_prompt §1.5). Этот флаг страхует от повторных переспросов.
        self.profile_offered: bool = False
        # Кэши TourVisor-ответов с разными TTL. Ключи: код отеля / tourid (строкой).
        # value = {"data": <payload>, "ts": <unix_ts>}
        self.hotel_info_cache: Dict[str, Dict[str, Any]] = {}
        self.tour_details_cache: Dict[str, Dict[str, Any]] = {}
        self.actualize_cache: Dict[str, Dict[str, Any]] = {}
        # Счётчик вызовов tools в ТЕКУЩЕМ ходе. Ключ — имя инструмента,
        # значение — сколько раз LLM попытался вызвать. Используется как
        # safety-net против петель (`get_tour_details` подряд по 3 турам).
        self.tools_used_this_turn: Dict[str, int] = {}
        self.created_at = datetime.utcnow()

    def reset_turn_state(self) -> None:
        """Сбросить состояние, относящееся к одному ходу диалога."""
        self.turn_pending_cards = []
        self.turn_intent = None
        self.last_cascade_missing = None
        self.last_cascade_nudge = None
        self.allow_service_ids_this_turn = False
        self.tools_used_this_turn = {}


SESSIONS: Dict[str, CopilotSession] = {}


def _get_session(conversation_id: Optional[str]) -> CopilotSession:
    cid = conversation_id or str(uuid.uuid4())
    session = SESSIONS.get(cid)
    if session is None:
        session = CopilotSession(cid)
        SESSIONS[cid] = session
    return session


# ────────────────────────────────────────────────────────────────────
# OpenAI client
# ────────────────────────────────────────────────────────────────────


_openai_client_cache: Dict[str, Any] = {}


def _get_openai_client():
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return None
    base_url = os.getenv("OPENAI_BASE_URL") or None
    cache_key = f"{api_key[:8]}|{base_url or ''}"
    cached = _openai_client_cache.get(cache_key)
    if cached is not None:
        return cached
    try:
        from openai import OpenAI
    except ImportError:
        logger.error("openai package not installed")
        return None
    kwargs: Dict[str, Any] = {
        "api_key": api_key,
        "timeout": 120.0,
        "max_retries": int(os.getenv("OPENAI_SDK_MAX_RETRIES", "4")),
    }
    if base_url:
        kwargs["base_url"] = base_url
    headers: Dict[str, str] = {}
    if base_url and "openrouter" in base_url:
        headers["HTTP-Referer"] = os.getenv("OPENROUTER_REFERRER", "http://127.0.0.1:3000")
        headers["X-Title"] = os.getenv("OPENROUTER_TITLE", "Tourvisor AI Copilot Demo")
    extra_raw = os.getenv("OPENAI_EXTRA_HEADERS")
    if extra_raw:
        try:
            extra = json.loads(extra_raw)
            if isinstance(extra, dict):
                for k, v in extra.items():
                    headers[str(k)] = str(v)
        except json.JSONDecodeError:
            logger.warning("OPENAI_EXTRA_HEADERS is not valid JSON, ignoring")
    if headers:
        kwargs["default_headers"] = headers
    client = OpenAI(**kwargs)
    _openai_client_cache[cache_key] = client
    logger.info(
        "OpenAI client init: base_url=%s model=%s headers=%s",
        base_url or "<default>",
        DEFAULT_MODEL,
        sorted(headers.keys()),
    )
    return client


def _model_supports_temperature(model: str) -> bool:
    """gpt-5 / o1 / o3 families on OpenAI lock temperature to default."""
    lowered = model.lower()
    if "gpt-5" in lowered:
        return False
    if lowered.startswith("openai/o") or "/o1" in lowered or "/o3" in lowered:
        return False
    return True


def _is_reasoning_model(model: str) -> bool:
    """Detect gpt-5 / o1 / o3 reasoning families that accept reasoning_effort."""
    lowered = model.lower()
    if "gpt-5" in lowered:
        return True
    if lowered.startswith("openai/o") or "/o1" in lowered or "/o3" in lowered:
        return True
    return False


# ────────────────────────────────────────────────────────────────────
# Cascade: 6-slot validation (port from mgp_v2.yandex_handler._check_cascade_slots).
# Адаптировано под турагентский режим: позволяем «без перелёта» / departure=99,
# мягче воспринимаем "skip" по бюджету (агенту не всегда важен), но dates/party
# и quality check — обязательные. См. backend/prompts/system_prompt_agent_copilot.md §3.
# ────────────────────────────────────────────────────────────────────

_DEPARTURE_PATTERNS = [
    r"\b(?:москв[аыуе]|мск)\b",
    r"\b(?:петербург\w*|питер\w*|спб|санкт-петербург\w*)\b",
    r"\b(?:екатеринбург\w*|еката|екб)\b",
    r"\b(?:новосибирск\w*)\b",
    r"\b(?:казан[ьи]\w*)\b",
    r"\b(?:краснодар\w*)\b",
    r"\b(?:красноярск\w*)\b",
    r"\b(?:самар\w*)\b",
    r"\b(?:уф[аыуе]\w*)\b",
    r"\b(?:перм[ьи]\w*)\b",
    r"\b(?:челябинск\w*)\b",
    r"\b(?:ростов\w*)\b",
    r"\b(?:минеральн\w+\s*вод|мин\s*вод)\b",
    r"\b(?:тюмен[ьи])\b",
    r"\b(?:нижн\w+\s*новгород|нижний)\b",
    r"\b(?:волгоград)\b",
    r"\b(?:воронеж)\b",
    r"\b(?:омск)\b",
    r"\b(?:иркутск)\b",
    r"\b(?:хабаровск)\b",
    r"\b(?:сочи)\b",
    r"(?:вылет|вылетаем|летим|улетаем)\s+(?:из|с)\s+\w+",
    r"(?:из|с)\s+\w+\s+(?:вылет|вылетаем|улетаем)",
    r"без\s*перел[её]т",
    r"только\s*отел[ьяию]",
]

_MONTH_NAMES_RX = (
    r"(?:января|февраля|марта|апреля|мая|июня|июля|"
    r"августа|сентября|октября|ноября|декабря)"
)

_SPECIFIC_DATE_PATTERNS = [
    r"\d{1,2}\.\d{1,2}(?:\.\d{2,4})?",
    r"\d{1,2}\s+" + _MONTH_NAMES_RX,
    r"(?:в\s+)?(?:начал|середин|конц)\w*\s+" + _MONTH_NAMES_RX,
    r"(?:в\s+)?(?:начал|середин|конц)\w*\s+месяца",
    r"(?:на\s+)?(?:майские|новогодние|новый год|8 марта|23 февраля|каникул)",
    r"(?:завтра|послезавтра|через\s+\w+\s+дн|через\s+неделю|через\s+месяц)",
    r"(?:в\s+)?(?:этом|следующем)\s+месяце",
    r"(?:в\s+)?ближайшее\s+время",
    r"(?:первой|второй)\s+половин[еы]",
    r"ближе\s+к\s+(?:начал|конц|середин)",
    r"(?:под|к)\s+конец",
    r"(?:ближайш\w+\s+(?:вылет|дат|рейс))",
    r"(?:всё?\s*равно\s*(?:когда|какая?\s+дат))",
    r"(?:какой\s+есть|какая\s+есть|что\s+есть)",
    r"(?:любой\s+(?:период|ближайший|вылет|дат))",
    r"(?:не\s*важно\s+когда|неважно\s+когда)",
]

_BARE_MONTH_RX = (
    r"(?:январ[еья]|феврал[еья]|март[еа]?|апрел[еья]|ма[еяй]|"
    r"июн[еья]|июл[еья]|август[еа]?|сентябр[еья]|октябр[еья]|"
    r"ноябр[еья]|декабр[еья])"
)

_MONTH_QUALIFIER_PATTERNS = [
    r"\b(?:начал[еоу]|начало)\b",
    r"\b(?:середин[еуы]|середина)\b",
    r"\b(?:конц[еуы]|конец)\b",
    r"(?:перв\w+|втор\w+)\s+половин",
    r"(?:последн\w+|первая|первую|первой)\s+(?:недел\w+)",
    r"\bс\s+\d{1,2}\b.*?\bпо\s+\d{1,2}\b",
]

_NIGHTS_PATTERNS = [
    r"\d+\s*(?:ноч|дн|день|дней|ночей)",
    r"(?:на\s+)?(?:неделю|недельку|две недели|2 недели)",
    r"\bнедел[яюи]\b",
    r"(?:на\s+)?(?:выходные|уикенд)",
    r"(?:с\s+)?\d{1,2}(?:\.\d{1,2})?(?:\s+)?(?:по|-)(?:\s+)?\d{1,2}",
]

_TRAVELERS_PATTERNS = [
    r"(?:взрослы[хй]|взр\.?|вз\.?|adults)",
    r"(?:дет(?:ей|и|ьми|ям)?|ребен(?:ок|ка)|child)",
    r"(?:я\s+)?(?:один|одна|сам|одиночк)",
    r"(?:двое|два|две)\s+(?:взрослы[хй]|человек|чел\.?)",
    r"(?:трое|три|четыре|пять|шесть)\s+(?:взрослы[хй]|человек|чел\.?)",
    r"\d+\s*(?:взрослы[хй]|человек|чел\.?|взр|вз)",
    r"\d+\s*(?:в|вз)\s*\+",
    r"(?:с\s+)?(?:мужем|женой|парнем|девушкой|подругой|другом)",
    r"(?:вдво[её]м|втро[её]м|вчетвером|впятером)",
    r"\d+[-–]\d+\(\d+",
    r"(?:мы\s+с\s+)",
    r"(?:семь[яёе]|family)\s*\d*\s*\+\s*\d*",
]

_STARS_PATTERNS = [
    r"\d\s*[-–—]\s*\d\s*(?:зв[её]зд|\*|⭐|★)",  # «4-5★», «4-5 звёзд»
    r"\d\s*(?:зв[её]зд|\*|⭐|★)",  # «5★», «5*», «4 звезды»
    r"\d[\s\-\+]*(?:зв[её]зд|\*|⭐|★)",
    r"(?:пяти|четыр[её]х|тр[её]х)зв[её]зд",
    r"\b(?:пять|четыре|три|два)\s+зв[её]зд",
    r"\b(?:пят[её]рк|четв[её]рк|тройк)",
]

_MEAL_PATTERNS = [
    r"вс[её]\s*включен",
    r"ультра\s*вс[её]\s*включ",
    r"all\s*incl",
    r"ол+\s*инклюзив",
    r"\b(?:аи|уаи)\b",
    r"\b(?:ai|uai)\b",
    r"(?:полупансион|half\s*board|\bhb\b)",
    r"(?:полный\s*пансион|full\s*board|\bfb\b)",
    r"(?:только\s*)?завтрак\w*",
    r"\b(?:bb|ro|ob)\b",
    r"(?:без\s*питани)",
]

_QC_SKIP_PATTERNS = [
    r"(?:любой|любую|любое|любые)\s+(?:отель|категори|звёзд|звезд|питани)",
    r"(?:любой|любая|любое)\b",
    r"(?:без\s*разницы|(?:всё|все)\s*равно(?!\s*когда))",
    r"(?:не\s*важно|неважно|не\s*принципиально)",
    r"(?:на\s+(?:ваше?|твоё?|твое?)\s+усмотрени)",
    r"(?:рассмотрим\s+вариант|покажите?\s+что\s+есть|какие\s+есть)",
    r"(?:покажите?\s+что-нибудь|что\s+посоветуете)",
]

_HOTEL_BRAND_PATTERNS = [
    r"\b(?:rixos|hilton|delphin|swissotel|kempinski|calista|titanic|gloria|regnum|maxx\s*royal)\b",
    r"\b(?:iberostar|marriott|sheraton|radisson|accor|hyatt|intercontinental)\b",
    r"\b(?:wellness\s*park|alex\s*beach|alexius)\b",
    r"(?:в\s+)?отел[ьеи]\s+[а-яА-Яa-zA-Z]{3,}",
]

_QC_ASKED_PHRASES = (
    "категорию отеля",
    "тип питания",
    "питание предпочитаете",
    "какой отель предпочитаете",
    "какую звёздность",
    "какую звездность",
    "сколько звёзд",
    "сколько звезд",
    "звёздность отел",
    "звездность отел",
)

# Паттерны для распознавания бюджета в речи агента или клиента.
# Включаем как явные суммы («до 200к», «до 500 000»), так и
# нечёткие формулировки («любой бюджет», «не критично», «без ограничений»).
_BUDGET_PATTERNS = [
    r"до\s*\d{2,4}\s*(?:к|тыс|т\.?р|тысяч)",
    r"до\s*\d{4,7}\s*(?:руб|₽|рубл)?",
    r"\bбюджет\w*\b",
    r"\bлимит\w*\b",
    r"\b(?:не|без)\s*(?:критич|важн|принципиаль)",
    r"\bлюб(?:ой|ая|ое)\s+(?:бюджет|сумм|цен|ценов\w+|стоимост)",
    r"\bбез\s+ограничен\w*",
    r"(?:недорог\w*|подешевл\w*|подоступн\w*|эконом)",
    r"(?:премиум|дорог\w*|без\s+ограничен)",
]

_BUDGET_ASKED_PHRASES = (
    "бюджет у клиента",
    "какой бюджет",
    "ориентируется по бюджету",
    "бюджет на тур",
    "сумма у клиента",
    "цена клиента",
    "ценовой диапазон",
)

_NUDGE_MAP: Dict[str, str] = {
    # Все вопросы — от лица турагента, который опрашивает клиента,
    # и формулируются в третьем лице («ваш клиент / у клиента»).
    "страна / направление": "Какое направление рассматривает ваш клиент — страна или конкретный курорт?",
    "город вылета": "Откуда удобнее вылетать клиенту? (Москва, СПб, регионы)",
    "даты/месяц и длительность": (
        "На какие даты ориентируется клиент и сколько ночей планируете?"
    ),
    "даты/месяц вылета": "В каком месяце или на какие даты планируете вылет клиенту?",
    "промежуток в месяце (начало/середина/конец)": (
        "Уточните клиенту: начало, середина или конец месяца?"
    ),
    "состав путешественников": (
        "Сколько взрослых поедет и есть ли дети у клиента? Если есть — сколько лет."
    ),
    "возраст ребёнка": "Сколько лет ребёнку клиента? (если детей несколько — каждый возраст)",
    "категорию отеля и тип питания": (
        "Какие пожелания у клиента по категории отеля и питанию? "
        "(например, 4-5★ всё включено)"
    ),
    "категорию отеля (звёздность)": "Какая категория отеля устроит клиента (3-4★, 4-5★, только 5★)?",
    "тип питания": "Какое питание предпочтительно клиенту — всё включено, завтраки, полупансион?",
    "бюджет": "Какой бюджет на тур у клиента? (если не критично — так и скажите)",
}


_SERVICE_ID_REQUEST_RE = re.compile(
    r"\b(?:id|айди|ид|tourid|tour id|hotelcode|hotel code|requestid|request id|код(?:ы|а)?|служебн\w*)\b",
    re.I,
)


def _wants_service_ids(text: str) -> bool:
    """True only when the agent explicitly asks for technical identifiers/codes."""
    return bool(_SERVICE_ID_REQUEST_RE.search(text or ""))


def _sanitize_agent_reply(text: str, *, allow_service_ids: bool = False) -> str:
    """Remove internal API-ish wording from normal assistant replies.

    The product is for tour agents, so technical IDs are allowed only on explicit request
    ("покажи tourid", "нужен hotelcode"). In all other replies the assistant should sound
    like a professional travel copilot, not like a backend log.
    """
    if not text:
        return text

    cleaned = text

    # API/tool naming should not leak into conversational replies.
    replacements = {
        r"\bTourVisor API\b": "TourVisor",
        r"\bAPI TourVisor\b": "TourVisor",
        r"\bAPI\b": "сервис",
        r"\bsearch_tours\b": "поиск",
        r"\bget_search_results\b": "получение результатов",
        r"\bget_hot_tours\b": "подбор горящих туров",
        r"\bget_hotel_info\b": "карточка отеля",
        r"\bget_tour_details\b": "детали тура",
        r"\bactualize_tour\b": "актуализация цены",
        r"\bbuild_collection\b": "сборка подборки",
        r"\bactdetail\.php\b": "детали тура",
        r"\bactualize\.php\b": "актуализация",
        r"\btourid\b": "номер тура",
        r"\bhotelcode\b": "код отеля",
        r"\boperatorlink\b": "ссылка оператора",
        r"\baddpayments\b": "доплаты",
        r"\bnotincluded\b": "не входит",
        r"\bfunction call\b": "действие",
        r"\btool call\b": "действие",
        r"\bdemo-выдача\b": "тестовая выдача",
        r"\bdemo-каталог\b": "тестовый каталог",
        r"\bdemo-подборка\b": "подборка",
        r"\bdemo-тур\b": "тур",
        r"\bdemo-режим\b": "тестовый режим",
        r"\bDEMO-режим[ае]?\b": "тестовом режиме",
        r"\bdemo\b": "тестовый режим",
        r"\bактуализировать туры\b": "проверить актуальность туров",
        r"\bConnectError\b": "сетевой сбой",
        r"\bAPIConnectionError\b": "сетевой сбой",
        r"\bSSLError\b": "сетевой сбой",
        r"\bReadTimeout\b": "таймаут",
        r"\bTourVisorAPIError\b": "ошибка TourVisor",
    }
    for pattern, repl in replacements.items():
        cleaned = re.sub(pattern, repl, cleaned, flags=re.I)

    # Hide demo/environment wording from UX-facing replies. In demo/llm_only mode we still
    # need to be honest about актуальность, but not with engineering vocabulary.
    cleaned = re.sub(
        r"это\s+(?:демо|тестовая)?\s*[-‑–—]?\s*подборка\s*\([^)]*(?:окружени|подключ)[^)]*\)\s*[—-]\s*",
        "Цены и наличие нужно проверить перед отправкой клиенту — ",
        cleaned,
        flags=re.I,
    )
    cleaned = re.sub(
        r"\b(?:демо|тестов(?:ая|ое|ый|ые)|демонстрационн\w*)\s*[-‑–—]?\s*(?:выдач\w*|подборк\w*|режим\w*|тур\w*|tourid\w*)",
        "подборка",
        cleaned,
        flags=re.I,
    )
    cleaned = re.sub(r"\bподборк\w*\s+демо\b", "подборка", cleaned, flags=re.I)
    cleaned = re.sub(r"\bдемо[-‑–—]?\s*вариант\w*\b", "варианты", cleaned, flags=re.I)
    cleaned = re.sub(r"\bдемо[-‑–—]?\s*источник\w*\b", "предварительных данных", cleaned, flags=re.I)
    cleaned = re.sub(r"\bкаталог\s+демонстрационн\w*\b", "данные требуют проверки", cleaned, flags=re.I)
    cleaned = re.sub(r"\bнужно\s+подключить\s+реальн\w*\s+TourVisor\b", "нужно проверить актуальность в TourVisor", cleaned, flags=re.I)
    cleaned = re.sub(r"\bвыдача\s+подборка\b", "подборка", cleaned, flags=re.I)
    cleaned = re.sub(r"\bне\s+из\s+реального\s+TourVisor\b", "требует проверки в TourVisor", cleaned, flags=re.I)
    cleaned = re.sub(
        r"\b(?:в\s+)?(?:демо|тестов(?:ой|ая|ое|ый|ые)|демонстрационн\w*)\s*[-‑–—]?\s*(?:карточк\w*|ответ\w*)",
        "в карточке",
        cleaned,
        flags=re.I,
    )
    cleaned = re.sub(r"\bв\s+демо[-‑–—]выдаче\b", "в текущей выдаче", cleaned, flags=re.I)
    cleaned = re.sub(
        r"\bTourVisor\s+не\s+подключ[её]н\s+в\s+текущем\s+окружении\b",
        "данные требуют проверки перед отправкой клиенту",
        cleaned,
        flags=re.I,
    )
    cleaned = re.sub(
        r"\bTourVisor\s+не\s+подключ[её]н\s+сейчас\b",
        "данные требуют проверки в TourVisor",
        cleaned,
        flags=re.I,
    )
    cleaned = re.sub(r"\bподключ(?:ить|у)?\s+живой\s+TourVisor\b", "запустить живой поиск в TourVisor", cleaned, flags=re.I)
    cleaned = re.sub(r"\bживой\s+сервис\b", "актуальную выдачу", cleaned, flags=re.I)
    cleaned = re.sub(r"\bреальн(?:ом|ый|ого)\s+сервис(?:е|)\b", "TourVisor", cleaned, flags=re.I)
    cleaned = re.sub(r"\bв\s+подборка\b", "в подборке", cleaned, flags=re.I)
    cleaned = re.sub(r"\bподборка\s+подборка\b", "подборка", cleaned, flags=re.I)
    cleaned = re.sub(r"\bданные\s+из\s+встроенн\w+\s+каталог\w*\b", "данные требуют проверки", cleaned, flags=re.I)
    cleaned = re.sub(r"\bвстроенн\w+\s+каталог\w*\b", "предварительная выдача", cleaned, flags=re.I)
    cleaned = re.sub(r"\bпо\s+этому\s+коду\s+отеля\b", "по этому отелю", cleaned, flags=re.I)
    cleaned = re.sub(r"\b(\d+)\s*взр\.?\b", r"\1 взрослых", cleaned, flags=re.I)
    cleaned = re.sub(r"\bя\s+забронирую(?:/актуализирую)?\b", "я проверю актуальность", cleaned, flags=re.I)
    cleaned = re.sub(r"\bзабронирую/актуализирую\b", "проверю актуальность", cleaned, flags=re.I)

    # Humanize common internal meal labels.
    cleaned = re.sub(r"\bAI\s*\((вс[её]\s*включено)\)", r"\1", cleaned, flags=re.I)
    cleaned = re.sub(r"\bUAI\s*\((ультра\s*вс[её]\s*включено)\)", r"\1", cleaned, flags=re.I)
    cleaned = re.sub(r"\bBB\s*\((завтрак\w*)\)", r"\1", cleaned, flags=re.I)
    cleaned = re.sub(r"\bHB\s*\((полупансион)\)", r"\1", cleaned, flags=re.I)

    # Country/code accidents like "Египет-99" should be displayed as a country name.
    country_names = (
        "Египет", "Турция", "Таиланд", "ОАЭ", "Мальдивы", "Россия", "Абхазия",
        "Греция", "Кипр", "Вьетнам", "Шри-Ланка", "Куба", "Доминикана",
    )
    for country in country_names:
        cleaned = re.sub(rf"\b{country}\s*[-–—]\s*\d+\b", country, cleaned, flags=re.I)

    if not allow_service_ids:
        # Remove raw API params and parenthesized city codes from normal replies.
        cleaned = re.sub(
            r"\b(?:departure|country|datefrom|dateto|nightsfrom|nightsto|adults|child|"
            r"starsbetter|stars|mealbetter|meal|regions|subregions|hotels|operators|"
            r"pricefrom|priceto|pricetype|currency)\s*=\s*[\w.,:-]+",
            "",
            cleaned,
            flags=re.I,
        )
        cleaned = re.sub(r"\b(?:departure|country|meal|starsbetter|hotelcode|tourid|requestid)\s*[:#]\s*[\w.-]+", "", cleaned, flags=re.I)
        cleaned = re.sub(r"\((?:код\s*)?\d{1,6}\)", "", cleaned, flags=re.I)
        cleaned = re.sub(r"\bкод\s+города\b", "город вылета", cleaned, flags=re.I)
        cleaned = re.sub(r"\bкод\s+(\d{3,})\b", "", cleaned, flags=re.I)
        cleaned = re.sub(r"\bнужен\s+(?:код\s+отеля|hotelcode)\b", "нужно уточнить отель", cleaned, flags=re.I)
        cleaned = re.sub(r"\bслужебн\w+\s+код\w*\b", "идентификатор", cleaned, flags=re.I)
        cleaned = re.sub(r"\bпокажи(?:те)?\s*,?\s*пожалуйста,\s*(?:карточку/)?код\b", "уточните", cleaned, flags=re.I)
        cleaned = re.sub(r"\b(?:tourid|hotelcode|requestid)\s+[\w.-]+\b", "", cleaned, flags=re.I)
        # После замены `tourid → номер тура` цифры могут остаться в виде «номер тура 12345».
        # Убираем такие хвосты, чтобы id не светились в обычном ответе агенту.
        cleaned = re.sub(
            r"\b(?:номер\s+тура|код\s+отеля|идентификатор\s+запроса)\s*[№#:]?\s*[\w.-]+",
            "",
            cleaned,
            flags=re.I,
        )
        cleaned = re.sub(r"\(\s*[\w.-]{4,}\s*\)", "", cleaned)

    # Cosmetic cleanup after removals.
    cleaned = re.sub(r"[ \t]{2,}", " ", cleaned)
    cleaned = re.sub(r"(\d+\s+взрослых)\.,", r"\1,", cleaned)
    cleaned = re.sub(r"\s*,\s*(?=[,.!?;:]|$)", "", cleaned)
    cleaned = re.sub(r"(?:^|\n)[ \t]*[,.;:][ \t]*", "\n", cleaned)
    cleaned = re.sub(r"\s+([,.;:!?])", r"\1", cleaned)
    cleaned = re.sub(r"\(\s*\)", "", cleaned)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    return cleaned.strip()


def _replace_placeholder_hotels(text: str, cards: List[Dict[str, Any]]) -> str:
    """Replace model placeholders like Hotel A / Hotel B with real card names."""
    if not text or not cards:
        return text
    cleaned = text
    placeholder_pairs = (
        ("Hotel A", 0),
        ("Hotel B", 1),
        ("Hotel C", 2),
        ("Отель A", 0),
        ("Отель B", 1),
        ("Отель C", 2),
    )
    for placeholder, idx in placeholder_pairs:
        if idx >= len(cards):
            continue
        name = _coerce_str(cards[idx].get("hotel_name")).strip()
        if name:
            cleaned = re.sub(rf"\b{re.escape(placeholder)}\b", name, cleaned, flags=re.I)
    return cleaned


_HOTEL_INFO_FOLLOWUP_RE = re.compile(
    # `дет(?!ал)` — не путать «детский клуб / для детей» (нам нужно)
    # с «детали тура» (это §7.5.9 → get_tour_details, ловится LLM).
    r"(?:расскажи|подроб(?!н\w*\s+тур)|опис|пляж|питани|реб[её]н|дет(?!ал)|фото|отзыв|что\s+по)\w*",
    re.I,
)


def _is_tour_details_request(text: str) -> bool:
    """Эвристика «агент просит ДЕТАЛИ тура» — для приоритета над hotel-info follow-up.

    Эти триггеры ведут в §7.5.9 (get_tour_details), а не в карточку отеля.
    """
    if not text:
        return False
    lowered = text.lower()
    return bool(re.search(
        r"\bдетал(?:и|ью|ей|ям)\s+(?:тур|перел[её]т|рейс)|"
        r"\bчто\s+вход(?:ит|ят)\s+в\s+цен|"
        r"\bбагаж\b|"
        r"\bруч\w+\s+клад|"
        r"\bдоплат\w*|"
        r"\bне\s+включен\w*|"
        r"\bтоплив\w+\s+сбор",
        lowered,
    ))


def _select_card_from_followup(text: str, cards: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """Pick a card from the latest result for follow-ups like 'первый отель'."""
    if not text or not cards:
        return None
    lower = text.lower()
    ordinal_map = (
        (0, (r"\bперв\w*\b", r"\b1\s*(?:й|ый|вариант|отел)", r"\bтоп[-\s]?1\b")),
        (1, (r"\bвтор\w*\b", r"\b2\s*(?:й|ой|вариант|отел)", r"\bтоп[-\s]?2\b")),
        (2, (r"\bтрет\w*\b", r"\b3\s*(?:й|ий|вариант|отел)", r"\bтоп[-\s]?3\b")),
    )
    for idx, patterns in ordinal_map:
        if idx < len(cards) and any(re.search(pattern, lower) for pattern in patterns):
            return cards[idx]

    for card in cards:
        name = _coerce_str(card.get("hotel_name")).lower()
        if name and name in lower:
            return card
        # Also allow partial match by first two meaningful words.
        words = [w for w in re.split(r"\W+", name) if len(w) >= 4]
        if len(words) >= 2 and all(word in lower for word in words[:2]):
            return card
    return None


def _compose_hotel_info_reply(info: Dict[str, Any], card: Dict[str, Any]) -> str:
    """Short, human-readable hotel-info answer without internal identifiers."""
    name = _coerce_str(info.get("name")) or _coerce_str(card.get("hotel_name")) or "Отель"
    stars = _coerce_int(info.get("stars")) or _coerce_int(card.get("hotel_stars"))
    region = _coerce_str(info.get("region")) or _coerce_str(card.get("resort"))
    country = _coerce_str(info.get("country")) or _coerce_str(card.get("country"))
    rating = _coerce_str(info.get("rating")) or _coerce_str(card.get("hotel_rating"))
    description = _coerce_str(info.get("description")).strip()
    beach = _coerce_str(info.get("beach")).strip()
    child = _coerce_str(info.get("child")).strip()
    meal = _coerce_str(info.get("meallist")).strip() or _coerce_str(card.get("meal_description")).strip()
    images_count = _coerce_int(info.get("images_count"))

    header_bits = [name]
    if stars:
        header_bits.append(f"{stars}★")
    if region or country:
        header_bits.append(" / ".join(part for part in (region, country) if part))
    if rating:
        header_bits.append(f"рейтинг {rating}")

    lines = [" — ".join(header_bits) + "."]
    if description:
        lines.append(f"Описание: {description[:650]}")
    if beach:
        lines.append(f"Пляж: {beach[:320]}")
    if meal:
        lines.append(f"Питание: {_sanitize_agent_reply(meal)[:220]}")
    if child:
        lines.append(f"Для детей: {child[:280]}")
    if images_count:
        lines.append(f"Фото: есть, {images_count} изображений в карточке.")
    lines.append("Следующий шаг: можно открыть этот вариант для клиента или сравнить его с соседними отелями из выдачи.")
    return _sanitize_agent_reply("\n\n".join(lines))


async def _try_direct_hotel_info_followup(
    session: CopilotSession,
    user_message: str,
) -> Optional[Dict[str, Any]]:
    """Deterministically answer 'tell me about first hotel' without asking for hotelcode."""
    if not _HOTEL_INFO_FOLLOWUP_RE.search(user_message or ""):
        return None
    # Если это явно запрос ДЕТАЛЕЙ тура / актуализации — отдаём LLM (§7.5.9 / §7.5.10),
    # потому что им нужны get_tour_details / actualize_tour, а не hotel.php.
    if _is_tour_details_request(user_message):
        return None
    card = _select_card_from_followup(user_message, session.last_cards)
    if not card:
        return None
    hotel_code = _coerce_int(card.get("hotel_code"))
    if not hotel_code:
        return None

    args = {"hotelcode": hotel_code, "imgbig": 1, "removetags": 1, "reviews": 1}
    client = TourVisorClient()
    try:
        tool_payload = await _tool_get_hotel_info(client, args, session)
    except Exception as exc:  # pragma: no cover - defensive
        logger.exception("[%s] direct hotel follow-up failed", session.id)
        tool_payload = _format_tourvisor_error(exc)
    finally:
        await client.close()

    if tool_payload.get("error"):
        return None
    reply = _compose_hotel_info_reply(tool_payload, card)
    session.history.append({"role": "assistant", "content": reply})
    return _build_agent_response(session, reply, ["get_hotel_info"])


def _user_messages_from_history(history: List[Dict[str, Any]]) -> List[str]:
    """Только реальные user-сообщения, без tool-результатов и системных нудж-ов."""
    out: List[str] = []
    for msg in history:
        if msg.get("role") != "user":
            continue
        content = msg.get("content") or ""
        if not isinstance(content, str):
            continue
        if not content:
            continue
        if content.startswith("Результаты вызванных функций"):
            continue
        if content.startswith("Результаты запросов:"):
            continue
        if content.startswith("СИСТЕМНАЯ ОШИБКА"):
            continue
        out.append(content)
    return out


def _check_cascade_slots(
    history: List[Dict[str, Any]],
    args: Dict[str, Any],
    is_follow_up: bool = False,
) -> tuple[bool, List[str]]:
    """Проверяем, что все обязательные слоты каскада собраны.

    Возвращает (is_complete, missing_slots) где missing_slots отсортирован по приоритету
    каскада: страна → вылет → даты → состав → QC.

    Логика:
    - Если args содержат полный валидный набор полей и это follow-up — доверяем модели.
    - Иначе ищем явные упоминания каждого слота в истории сообщений пользователя.
    """
    missing: List[str] = []

    # Страна (slot 1) — критически: без country search_tours TourVisor отдаёт ошибку.
    country_arg = args.get("country")
    has_country_arg = isinstance(country_arg, int) and country_arg > 0
    if not has_country_arg:
        try:
            country_arg = int(country_arg) if country_arg else 0
            has_country_arg = country_arg > 0
        except (TypeError, ValueError):
            has_country_arg = False

    # Args fast-path
    _dep = args.get("departure")
    _df = args.get("datefrom", "")
    _nf = args.get("nightsfrom")
    _ad = args.get("adults")
    _st = args.get("stars")
    _ml = args.get("meal")
    _args_have_all = (
        has_country_arg
        and isinstance(_dep, int) and _dep > 0
        and _df and re.match(r"\d{2}\.\d{2}\.\d{4}", str(_df))
        and isinstance(_nf, int) and _nf >= 1
        and isinstance(_ad, int) and _ad > 0
        and (
            (isinstance(_st, int) and _st > 0)
            or (isinstance(_ml, int) and _ml > 0)
        )
    )
    user_messages = _user_messages_from_history(history)
    user_text = " ".join(user_messages).lower()
    user_msg_count = len(user_messages)

    if _args_have_all:
        # Fast-path: LLM собрал все обязательные слоты в args, НО мы не доверяем
        # ему слепо — он мог тихо подставить дефолты (Москва, 2 взрослых, 7 ночей,
        # 4-5★, всё включено) без согласования с агентом. Поэтому сверяем каждый
        # критический слот с тем, что РЕАЛЬНО прозвучало в тексте от агента.
        # Это исправляет жалобу: «ассистент за турагента выбирает дефолтом».

        # Город вылета: должен быть упомянут в тексте, либо это follow-up, либо
        # стоит явное «без перелёта» (departure=99) — тогда упоминание не нужно.
        dep_explicit_in_args = isinstance(_dep, int) and _dep == 99
        has_departure_text = any(re.search(p, user_text) for p in _DEPARTURE_PATTERNS)
        if not is_follow_up and not dep_explicit_in_args and not has_departure_text:
            logger.info("[cascade] args have departure=%s but no user-text confirmation", _dep)
            return False, ["город вылета"]

        # Состав: если ни в одном сообщении агента не было ни «двое/семья/взрослых
        # /ребёнок» — не подставляем 2 взрослых молча.
        has_travelers_text = any(re.search(p, user_text) for p in _TRAVELERS_PATTERNS)
        if not is_follow_up and not has_travelers_text:
            logger.info("[cascade] args have adults=%s but no user-text confirmation", _ad)
            return False, ["состав путешественников"]

        # Даты: если в args есть конкретная datefrom, но в тексте нет ни одной
        # даты/месяца — это тихая выдумка LLM. Не запускаем поиск.
        has_specific_date = any(re.search(p, user_text) for p in _SPECIFIC_DATE_PATTERNS)
        has_bare_month = re.search(_BARE_MONTH_RX, user_text) is not None
        if not is_follow_up and not (has_specific_date or has_bare_month):
            logger.info("[cascade] args have datefrom=%s but no user-text date mention", _df)
            return False, ["даты/месяц вылета"]

        # Категория/питание: если в тексте не было ни звёзд, ни питания, ни бренда,
        # и агент не сказал «любая/не важно» — спрашиваем.
        has_stars_text = any(re.search(p, user_text) for p in _STARS_PATTERNS)
        has_meal_text = any(re.search(p, user_text) for p in _MEAL_PATTERNS)
        has_brand_text = any(re.search(p, user_text) for p in _HOTEL_BRAND_PATTERNS)
        last_user_msg = user_messages[-1].lower() if user_messages else ""
        has_skip_text = any(re.search(p, last_user_msg) for p in _QC_SKIP_PATTERNS)
        if not is_follow_up and not (has_stars_text or has_meal_text or has_brand_text or has_skip_text):
            logger.info("[cascade] args have stars/meal but no user-text confirmation")
            return False, ["категорию отеля и тип питания"]

        # Бюджет: спрашиваем при первом поиске, как раньше.
        budget_ok = (
            is_follow_up
            or bool(args.get("priceto") or args.get("pricefrom"))
            or any(re.search(p, user_text) for p in _BUDGET_PATTERNS)
        )
        if budget_ok:
            logger.info(
                "[cascade] trust args (follow_up=%s, user_msgs=%d)",
                is_follow_up, user_msg_count,
            )
            return True, []
        logger.info(
            "[cascade] args complete but budget missing (first search) — ask budget",
        )
        return False, ["бюджет"]

    # Slot 1: страна / направление
    has_country_in_text = bool(
        re.search(
            r"(?:турци|египе?т|оаэ|эмират|таиланд|мальдив|греци|кипр|"
            r"вьетнам|шри.?ланк|куб[аеу]|доминикан|индонези|бали|тунис|"
            r"черногори|болгари|хорвати|абхази|росси|сочи|крым|анап|"
            r"геленджик|казан|москв[ауеы]|питер|санкт-петербург|"
            r"италия|испани|франци|германи|чехи|"
            r"камбодж|малайзи|сингапур|япони|корея|китай|шри.?ланк)",
            user_text,
        )
    )
    if not has_country_arg and not has_country_in_text:
        missing.append("страна / направление")

    # Slot 2: город вылета
    has_departure = any(re.search(p, user_text) for p in _DEPARTURE_PATTERNS)
    if not has_departure:
        missing.append("город вылета")

    # Slot 3: даты + длительность
    has_specific_date = any(re.search(p, user_text) for p in _SPECIFIC_DATE_PATTERNS)
    has_bare_month = re.search(_BARE_MONTH_RX, user_text) is not None
    has_date_mention = has_specific_date or has_bare_month
    has_nights = any(re.search(p, user_text) for p in _NIGHTS_PATTERNS)

    if has_bare_month and not has_specific_date:
        if not any(re.search(p, user_text) for p in _MONTH_QUALIFIER_PATTERNS):
            missing.append("промежуток в месяце (начало/середина/конец)")

    if not has_date_mention and not has_nights:
        missing.append("даты/месяц и длительность")
    elif not has_date_mention:
        missing.append("даты/месяц вылета")

    # Slot 4: состав путешественников
    has_travelers = any(re.search(p, user_text) for p in _TRAVELERS_PATTERNS)
    if not has_travelers:
        missing.append("состав путешественников")

    # Возраст ребёнка (если args.child > 0, но childageN пуст и в тексте нет возраста)
    try:
        child_count = int(args.get("child", 0) or 0)
    except (TypeError, ValueError):
        child_count = 0
    if child_count > 0:
        has_childage_arg = any(args.get(f"childage{i}") for i in (1, 2, 3))
        if not has_childage_arg:
            child_age_in_text = any(
                re.search(p, user_text)
                for p in (
                    r"(?:ребен\w*|дет\w*|дочк\w*|сын\w*|малыш\w*)\s*(?:\d{1,2}\s*(?:лет|года?|мес))",
                    r"\d{1,2}\s*(?:лет|года?)\s*(?:ребен|дет|дочк|сын)",
                    r"(?:реб|ребёнок|ребенок)\s*\(\s*\d{1,2}",
                    r"реб?\s*\d{1,2}\s*лет",
                    r"\d+\s*(?:взр|в)\s*\+\s*(?:реб|р)?\s*\d{1,2}\s*(?:лет|г)",
                )
            )
            if not child_age_in_text:
                missing.append("возраст ребёнка")

    # Slot 5/6: Quality Check (звёздность + питание ИЛИ skip)
    has_stars = any(re.search(p, user_text) for p in _STARS_PATTERNS)
    has_meal = any(re.search(p, user_text) for p in _MEAL_PATTERNS)
    has_brand = any(re.search(p, user_text) for p in _HOTEL_BRAND_PATTERNS)

    last_user_msg = user_messages[-1].lower() if user_messages else ""
    has_skip = any(re.search(p, last_user_msg) for p in _QC_SKIP_PATTERNS)

    qc_passed = (has_stars and has_meal) or has_skip or (has_brand and has_meal)

    if not qc_passed:
        # Если ассистент уже задал QC-вопрос и клиент после него ОТВЕТИЛ — не блокируем повторно.
        last_qc_index = -1
        for idx, msg in enumerate(history):
            if msg.get("role") != "assistant":
                continue
            content = msg.get("content") or ""
            if not isinstance(content, str):
                continue
            if any(phrase in content.lower() for phrase in _QC_ASKED_PHRASES):
                last_qc_index = idx
        user_after_qc = False
        if last_qc_index >= 0:
            for msg in history[last_qc_index + 1:]:
                if msg.get("role") == "user":
                    content = msg.get("content") or ""
                    if isinstance(content, str) and content and not content.startswith(
                        ("Результаты", "СИСТЕМНАЯ ОШИБКА")
                    ):
                        user_after_qc = True
                        break
        if not user_after_qc:
            if not has_stars and not has_meal and not has_brand:
                missing.append("категорию отеля и тип питания")
            elif not has_stars and not has_brand:
                missing.append("категорию отеля (звёздность)")
            elif not has_meal:
                missing.append("тип питания")

    # Slot 7 (мягкий): бюджет — спрашиваем ОДИН раз при первом поиске.
    # Если в args уже есть priceto/pricefrom — слот закрыт.
    # Если в тексте есть упоминание (явное число или «не критично», «любой») — закрыт.
    # Если ассистент уже задал вопрос про бюджет и пользователь ответил после — закрыт.
    has_budget_arg = bool(
        args.get("priceto") or args.get("pricefrom") or args.get("pricetype")
    )
    has_budget_in_text = any(re.search(p, user_text) for p in _BUDGET_PATTERNS)
    if not is_follow_up and not has_budget_arg and not has_budget_in_text:
        last_budget_idx = -1
        for idx, msg in enumerate(history):
            if msg.get("role") != "assistant":
                continue
            content = msg.get("content") or ""
            if isinstance(content, str) and any(p in content.lower() for p in _BUDGET_ASKED_PHRASES):
                last_budget_idx = idx
        budget_user_after_ask = False
        if last_budget_idx >= 0:
            for msg in history[last_budget_idx + 1:]:
                if msg.get("role") == "user":
                    content = msg.get("content") or ""
                    if isinstance(content, str) and content and not content.startswith(
                        ("Результаты", "СИСТЕМНАЯ ОШИБКА")
                    ):
                        budget_user_after_ask = True
                        break
        if not budget_user_after_ask:
            missing.append("бюджет")

    # Сортировка по каскаду 1→7
    priority_order = (
        "страна / направление",
        "город вылета",
        "даты/месяц и длительность",
        "даты/месяц вылета",
        "промежуток в месяце (начало/середина/конец)",
        "состав путешественников",
        "возраст ребёнка",
        "категорию отеля и тип питания",
        "категорию отеля (звёздность)",
        "тип питания",
        "бюджет",
    )
    missing_sorted = sorted(missing, key=lambda s: priority_order.index(s) if s in priority_order else 99)

    return (len(missing_sorted) == 0), missing_sorted


_SLOT_TRACKER_PATTERNS = {
    "Направление": [
        (r"\bтурци[яюи]\b", "Турция"),
        (r"\bегипе?т\b", "Египет"),
        (r"\bоаэ\b|\bэмират\w*", "ОАЭ"),
        (r"\bтаиланд\w*|\bтайланд\w*", "Таиланд"),
        (r"\bмальдив\w*", "Мальдивы"),
        (r"\bгреци\w*", "Греция"),
        (r"\bкипр\b", "Кипр"),
        (r"\bвьетнам\b", "Вьетнам"),
        (r"\bшри[\s-]?ланк\w*", "Шри-Ланка"),
        (r"\bкуб[аеу]\b", "Куба"),
        (r"\bдоминикан\w*", "Доминикана"),
        (r"\bиндонези\w*|\bбали\b", "Индонезия (Бали)"),
        (r"\bтунис\w*", "Тунис"),
        (r"\bчерногори\w*", "Черногория"),
        (r"\bболгари\w*", "Болгария"),
        (r"\bхорвати\w*", "Хорватия"),
        (r"\bабхази\w*", "Абхазия"),
        (r"\bросси\w*|\bсочи\b|\bкрым\b|\bанап\w*|\bгеленджик\w*", "Россия"),
    ],
    "Город вылета": [
        (r"\b(?:из|с)\s+москв[ыеу]\b", "Москва"),
        (r"\bмоскв[аыуе]\b", "Москва"),
        (r"\bмск\b", "Москва"),
        (r"\bпитер\w*|санкт.?петербург\w*|спб\b", "Санкт-Петербург"),
        (r"\bекатеринбург\w*|екб\b|еката\b", "Екатеринбург"),
        (r"\bновосибирск\w*", "Новосибирск"),
        (r"\bказан[ьи]\w*", "Казань"),
        (r"\bкраснодар\w*", "Краснодар"),
        (r"\bсочи\b", "Сочи"),
        (r"без\s*перел[её]т|только\s*отел", "без перелёта"),
    ],
    "Состав": [
        (r"\b2\s*\+\s*1\b|двое\s+с\s+ребен", "2 взрослых + 1 ребёнок"),
        (r"\b2\s*взрослы[хй]\b|двое\s+взрослы[хй]|вдво[её]м", "2 взрослых"),
        (r"\b3\s*взрослы[хй]\b|трое\s+взрослы[хй]", "3 взрослых"),
        (r"\b1\s*взрослы[йх]\b|один\s+взрослы|одна\s+взросла|сам\s+одна", "1 взрослый"),
        (r"\bсемь[яёе]\b", "семья"),
    ],
    "Питание": [
        (r"вс[её]\s*включен|all\s*incl|ол+\s*инклюзив|\b(?:ai)\b", "всё включено"),
        (r"ультра\s*вс[её]\s*включ|\buai\b", "ультра всё включено"),
        (r"полупансион|\bhb\b|half\s*board", "полупансион"),
        (r"завтрак\w*|\bbb\b", "завтраки"),
        (r"без\s*питани|\bro\b|\bob\b", "без питания"),
    ],
    "Звёздность": [
        (r"\b5\s*[\*⭐]|пят[её]рк|\bпять\s+зв[её]зд|пятизв[её]зд", "5*"),
        (r"\b4\s*[\*⭐]|четв[её]рк|\bчетыре\s+зв[её]зд|четырёхзв[её]зд", "4*"),
        (r"\b3\s*[\*⭐]|тройк|\bтри\s+зв[её]зд|тр[её]хзв[её]зд", "3*"),
        (r"4-5\s*[\*⭐]|4\s*или\s*5\s*зв", "4-5*"),
    ],
}


def _update_collected_slots(session: "CopilotSession", user_message: str) -> None:
    """Извлекаем слоты из сообщения и обновляем session.collected_slots.

    Это «подсказка» для LLM (через system-сообщение в истории) и для frontend-бейджа.
    Мы не используем slot tracker как gate — gate делает _check_cascade_slots по полной
    истории. Tracker нужен, чтобы фронт показывал «вылет: Москва · даты: 24-31.10».
    """
    if not user_message:
        return
    text = user_message.lower().strip()
    for slot_name, patterns in _SLOT_TRACKER_PATTERNS.items():
        for pattern, fixed_value in patterns:
            if re.search(pattern, text, re.IGNORECASE):
                session.collected_slots[slot_name] = fixed_value
                break

    # Даты / диапазон дат
    range_match = re.search(
        r"\bс?\s*(\d{1,2})(?:\.\d{1,2})?\s*(?:по|-|–)\s*(\d{1,2})(?:\.\d{1,2}\.?\d{0,4})?",
        text,
    )
    if range_match:
        session.collected_slots["Даты"] = range_match.group(0).strip()

    # Длительность
    nights_match = re.search(r"(\d{1,2})\s*ноч", text)
    if nights_match:
        session.collected_slots["Длительность"] = f"{nights_match.group(1)} ночей"

    # Бюджет — явная сумма
    budget_match = re.search(
        r"до\s*(\d{1,3}(?:\s*\d{3})*|\d+(?:к|тыс|т\.?р))\s*(?:руб|₽|тыс|к|т\.?р)?",
        text,
    )
    if budget_match:
        session.collected_slots["Бюджет"] = budget_match.group(0).strip()
    elif re.search(r"\b(?:не|без)\s*(?:критич|важн|принципиаль)|любой\s+бюджет|без\s+ограничен", text):
        session.collected_slots["Бюджет"] = "без жёсткого ограничения"
    elif re.search(r"\b(?:недорог\w*|подешевл\w*|эконом)", text):
        session.collected_slots["Бюджет"] = "эконом-сегмент"
    elif re.search(r"\b(?:премиум|дорог\w*|люкс)", text):
        session.collected_slots["Бюджет"] = "премиум-сегмент"


# ──────────────────────────────────────────────────────────────────────
# Лёгкий профиль клиента (см. system_prompt §1.5).
#
# Идея: профиль не вводится формой, агент просто пишет «семья 2+1, ребёнку
# годик, чувствительны к цене». Мы выцепляем регулярками сигналы и собираем
# короткое summary в session.client_profile (≤200 симв.). Профиль НЕ блокирует
# каскад и НЕ отменяет явные слова агента — это лишь подсказка для §7.5.8/9
# (сценарное сравнение, флаги kid_unfriendly).
# ──────────────────────────────────────────────────────────────────────

# Каждый триггер: (regex, человеко-читаемый ярлык). Порядок важен — более
# специфичные сначала (детский возраст до общих «дети»).
_PROFILE_TRIGGERS: List[Tuple[str, str]] = [
    (r"\bсем(?:ья|ье|ьи|ьёй|ей)\s+\d+\s*\+\s*\d+", "семья"),
    (r"\b(?:семь[яеи]|семейн)", "семья"),
    (r"\bпар[аое]\s+(?:взросл|молод)", "пара"),
    (r"\bмолодожён|молодожен|свадебн|медов\w+\s+месяц", "молодожёны"),
    (r"\b(?:ребён|ребен)(?:к[уаоме]|ок)|\bдет(?:и|ям|ьми|ей)|\bмалыш", "с детьми"),
    (r"\bподрост\w*", "подросток"),
    (r"\bбабушк|пенсионер|пожил", "пожилые"),
    (r"\bпостоянн\w+\s+клиент|VIP|вип-клиент", "постоянный клиент"),
    (r"\bпервый\s+раз\s+(?:за\s+границ|летит|едет)", "первый выезд"),
    (r"\b(?:бюджет\s+(?:жёстк|жестк|ограничен)|чувствит\w+\s+к\s+цене|эконом)", "чувствительны к цене"),
    (r"\b(?:не\s+критичн[оы]|без\s+огранич\w+|бюджет\s+(?:не\s+важен|свободн))", "бюджет свободный"),
    (r"\b(?:премиум|люкс|дорог\w+|пятёрк|5\s*\*|пять\s+звёзд)", "премиум"),
    (r"\bспокойн\w*|тих\w+\s+отдых|без\s+аниматор|без\s+шум", "спокойный отдых"),
    (r"\bактивн\w+\s+отдых|тусовк|вечеринк|пати|клуб", "активный отдых"),
    (r"\b(?:с|для)\s+(?:маленьк|младенц|годовалым)|\b(?:1|один|годик)\s*(?:год|годик)", "малыш до 2 лет"),
]

# Извлечение возраста ребёнка («ребёнку 1 год», «дочка 6 лет», «3 года»).
_PROFILE_KID_AGE_RX = re.compile(
    r"(?:ребён(?:к[уаоме]|ок)|малыш|дочк[ае]|сын[уа]?)\s*(?:[ей]?м?у?)?\s*(\d{1,2})\s*(?:год|лет|мес)",
    re.IGNORECASE,
)


def _extract_client_profile_hint(
    user_message: str, current: Optional[str]
) -> Optional[str]:
    """Безопасно обновить session.client_profile.

    Возвращает новое значение профиля (или старое, если оснований обновлять нет).
    Никогда не «угадывает»: если в сообщении нет триггеров — возвращает `current`.
    """
    if not user_message:
        return current

    text = user_message.strip()
    if len(text) < 4:
        return current
    lowered = text.lower()

    found_labels: List[str] = []
    for pattern, label in _PROFILE_TRIGGERS:
        if re.search(pattern, lowered, re.IGNORECASE):
            if label not in found_labels:
                found_labels.append(label)

    kid_match = _PROFILE_KID_AGE_RX.search(lowered)
    if kid_match:
        try:
            age = int(kid_match.group(1))
            if 0 <= age <= 17:
                age_label = f"ребёнок {age} лет"
                if age_label not in found_labels:
                    found_labels.append(age_label)
        except ValueError:
            pass

    if not found_labels:
        return current

    new_summary = ", ".join(found_labels)
    if len(new_summary) > 200:
        new_summary = new_summary[:197].rstrip(", ") + "…"

    if not current:
        return new_summary

    # Бережём накопленную информацию: если новые ярлыки богаче — мерджим.
    current_lower = current.lower()
    extra = [lbl for lbl in found_labels if lbl.lower() not in current_lower]
    if not extra:
        return current
    merged = current + ", " + ", ".join(extra)
    if len(merged) > 200:
        merged = merged[:197].rstrip(", ") + "…"
    return merged


_TOURVISOR_NETWORK_HINTS = (
    "ssl", "tls", "eof", "_ssl.c",
    "connect", "connection", "connecterror",
    "timeout", "timed out", "readtimeout", "writetimeout",
    "network", "dns", "resolve",
    "remote disconnected", "broken pipe", "reset by peer",
    "service unavailable", "bad gateway", "gateway timeout",
    "502", "503", "504",
)


def _format_tourvisor_error(exc: Exception, fallback_error: str = "tourvisor_error") -> Dict[str, Any]:
    """Make tool error payload semantic so the LLM can talk to the agent properly."""
    cls = exc.__class__.__name__
    msg = (str(exc) or "").strip()
    haystack = f"{cls} {msg}".lower()
    is_network = any(h in haystack for h in _TOURVISOR_NETWORK_HINTS)
    if isinstance(exc, (NoResultsError, SearchNotFoundError, TourIdExpiredError, TourVisorAPIError)):
        return {"error": cls, "message": msg or cls}
    if is_network:
        return {
            "error": "tourvisor_unavailable",
            "exception_class": cls,
            "message": msg or cls,
            "user_hint": (
                "TourVisor сейчас не отвечает. "
                "Скажи агенту, что это временный сбой сервиса, и предложи повторить запрос через 1–2 минуты. "
                "Не пытайся повторно выполнить то же действие в этом ходе."
            ),
        }
    return {
        "error": fallback_error,
        "exception_class": cls,
        "message": msg or cls,
    }


_TRANSIENT_HINTS = (
    "connection error",
    "connection reset",
    "connection aborted",
    "eof occurred",
    "_ssl.c",
    "tls",
    "timed out",
    "timeout",
    "remote disconnected",
    "broken pipe",
    "temporarily unavailable",
    "bad gateway",
    "service unavailable",
    "gateway timeout",
    "rate limit",
    "429",
    "502",
    "503",
    "504",
)


def _is_transient_llm_error(exc: Exception) -> bool:
    """Best-effort detection for retryable network/provider hiccups."""
    try:
        from openai import APIConnectionError, APITimeoutError, RateLimitError, InternalServerError
        if isinstance(exc, (APIConnectionError, APITimeoutError, RateLimitError, InternalServerError)):
            return True
    except ImportError:
        pass
    msg = (str(exc) or repr(exc)).lower()
    return any(hint in msg for hint in _TRANSIENT_HINTS)


def _llm_user_error_message(exc: Exception) -> str:
    """Return a user-facing message for a failed LLM call. Hide stack traces; suggest retry."""
    if _is_transient_llm_error(exc):
        return (
            "Сейчас не удалось получить ответ от AI-сервиса из-за временного сетевого сбоя. "
            "Повтори запрос — обычно это проходит за несколько секунд."
        )
    detail = str(exc).strip() or exc.__class__.__name__
    if len(detail) > 240:
        detail = detail[:240] + "…"
    return f"Ошибка LLM: {detail}. Можно повторить запрос."


def _llm_complete_with_backoff(client: Any, kwargs: Dict[str, Any], session_id: str, step: int):
    """Call client.chat.completions.create with extra exponential-backoff retries
    on top of SDK-level retries. Handles transient TLS/connection/rate-limit errors
    so transient OpenRouter hiccups don't surface as chat failures to the user."""
    max_attempts = int(os.getenv("LLM_BACKOFF_MAX_ATTEMPTS", "3"))
    base_delay = float(os.getenv("LLM_BACKOFF_BASE_SECONDS", "1.5"))
    last_exc: Optional[Exception] = None
    for attempt in range(max_attempts):
        try:
            return client.chat.completions.create(**kwargs)
        except Exception as exc:
            last_exc = exc
            if not _is_transient_llm_error(exc) or attempt == max_attempts - 1:
                raise
            delay = base_delay * (2 ** attempt)
            logger.warning(
                "[%s] llm_step %d transient error on attempt %d/%d, sleeping %.2fs (%s)",
                session_id, step, attempt + 1, max_attempts, delay, type(exc).__name__,
            )
            time.sleep(delay)
    if last_exc:
        raise last_exc
    raise RuntimeError("LLM call failed without exception")


def _system_prompt() -> str:
    base = SYSTEM_PROMPT_PATH.read_text(encoding="utf-8")
    today = datetime.now()
    nearest_from = today + timedelta(days=14)
    nearest_to = nearest_from + timedelta(days=7)
    runtime_block = (
        "\n\n## 10. Runtime context\n\n"
        f"- Сегодня: {today.strftime('%d.%m.%Y')} ({['пн','вт','ср','чт','пт','сб','вс'][today.weekday()]}).\n"
        f"- Дефолтное окно поиска при отсутствии явных дат: "
        f"{nearest_from.strftime('%d.%m.%Y')} — {nearest_to.strftime('%d.%m.%Y')}.\n"
        f"- Эту дату использовать сразу, без вызова get_current_date, если агент не просит явно «уточни сегодняшнюю».\n"
    )
    return base + runtime_block


def _load_openai_tools() -> List[Dict[str, Any]]:
    data = json.loads(FUNCTION_SCHEMAS_PATH.read_text(encoding="utf-8"))
    tools: List[Dict[str, Any]] = []
    for tool in data.get("tools", []):
        if tool.get("type") != "function":
            continue
        name = tool.get("name")
        if name not in AGENT_TOOLS:
            continue
        tools.append(
            {
                "type": "function",
                "function": {
                    "name": name,
                    "description": tool.get("description", ""),
                    "parameters": tool.get("parameters", {}),
                },
            }
        )
    return tools


_OPENAI_TOOLS_CACHE: Optional[List[Dict[str, Any]]] = None


def _openai_tools() -> List[Dict[str, Any]]:
    global _OPENAI_TOOLS_CACHE
    if _OPENAI_TOOLS_CACHE is None:
        _OPENAI_TOOLS_CACHE = _load_openai_tools()
    return _OPENAI_TOOLS_CACHE


# ────────────────────────────────────────────────────────────────────
# TourVisor helpers
# ────────────────────────────────────────────────────────────────────


def _has_tourvisor_credentials() -> bool:
    return bool(os.getenv("TOURVISOR_AUTH_LOGIN") and os.getenv("TOURVISOR_AUTH_PASS"))


def _strip_html(value: Any) -> str:
    if not value:
        return ""
    text = str(value)
    text = re.sub(r"<li[^>]*>", "; ", text, flags=re.I)
    text = re.sub(r"</li>", "", text, flags=re.I)
    text = re.sub(r"<br\s*/?>", "; ", text, flags=re.I)
    text = re.sub(r"<[^>]+>", "", text)
    text = re.sub(r"\s+", " ", text)
    text = text.replace(";;", ";").strip(" ;")
    return text


def _coerce_int(value: Any, default: int = 0) -> int:
    try:
        if value is None or value == "":
            return default
        return int(value)
    except (TypeError, ValueError):
        return default


def _coerce_str(value: Any, default: str = "") -> str:
    if value is None:
        return default
    return str(value)


def _normalize_reviews(raw: Any) -> List[Dict[str, Any]]:
    """Tourvisor returns reviews either as list or {"review": [...]}; normalize."""
    if not raw:
        return []
    if isinstance(raw, dict):
        raw = raw.get("review") or []
    if isinstance(raw, dict):
        raw = [raw]
    if not isinstance(raw, list):
        return []
    return [r for r in raw if isinstance(r, dict)]


def _normalize_url(url: Any) -> str:
    """Ensure protocol-relative URLs are usable in <img>."""
    s = _coerce_str(url).strip()
    if not s:
        return ""
    if s.startswith("//"):
        return f"https:{s}"
    if s.startswith("/"):
        return f"https://tourvisor.ru{s}"
    return s


# ──────────────────────────────────────────────────────────────────────
# Красные флаги (см. план §3).
#
# Статичные правила (без LLM): рассчитываются один раз при сборке карточки.
# Несут на фронт массив `flags` — рендерится бэйджами под звёздами и
# в блоке «На что обратить внимание» (см. план §5).
# Severity: info / warning / risk.
# ──────────────────────────────────────────────────────────────────────

CardFlag = Dict[str, str]


def _profile_has_small_kid(profile: Optional[str]) -> bool:
    if not profile:
        return False
    p = profile.lower()
    if "малыш до 2" in p:
        return True
    age_match = re.search(r"ребён[ок|кА-я]+\s*(\d{1,2})", p)
    if age_match:
        try:
            return int(age_match.group(1)) <= 5
        except ValueError:
            pass
    age_match2 = re.search(r"(\d{1,2})\s*(?:год|лет)", p)
    if age_match2:
        try:
            return int(age_match2.group(1)) <= 5
        except ValueError:
            pass
    return False


def _profile_wants_quiet(profile: Optional[str]) -> bool:
    if not profile:
        return False
    return "спокой" in profile.lower()


def _compute_card_flags(
    card: Dict[str, Any],
    client_profile: Optional[str] = None,
    *,
    sea_distance_meters: Optional[int] = None,
) -> List[CardFlag]:
    """Сформировать список флагов под карточку. Безопасно при пустых полях."""
    flags: List[CardFlag] = []

    rating_raw = card.get("hotel_rating") or "0"
    try:
        rating = float(str(rating_raw).replace(",", "."))
    except (TypeError, ValueError):
        rating = 0.0
    if 0 < rating < 3.8:
        flags.append({
            "type": "rating_low",
            "severity": "risk",
            "label": f"Рейтинг {rating:.1f}",
        })
    elif 3.8 <= rating < 4.0:
        flags.append({
            "type": "rating_low",
            "severity": "warning",
            "label": f"Рейтинг {rating:.1f}",
        })

    if card.get("night_flight"):
        flags.append({
            "type": "night_flight",
            "severity": "warning",
            "label": "Ночной перелёт",
        })

    on_request = bool(card.get("on_request"))
    hotel_status = card.get("hotel_status")
    try:
        hotel_status_int = int(hotel_status) if hotel_status is not None else None
    except (TypeError, ValueError):
        hotel_status_int = None
    if on_request or (hotel_status_int is not None and hotel_status_int != 2):
        flags.append({
            "type": "on_request",
            "severity": "risk",
            "label": "Под запрос",
        })

    sea_meters = sea_distance_meters
    if sea_meters is None:
        sea_text = card.get("sea_distance") or ""
        m = re.search(r"(\d+(?:[\.,]\d+)?)\s*(км|m|м)", str(sea_text), re.IGNORECASE)
        if m:
            try:
                value = float(m.group(1).replace(",", "."))
                unit = m.group(2).lower()
                sea_meters = int(value * 1000) if unit == "км" else int(value)
            except ValueError:
                sea_meters = None
    if sea_meters and sea_meters > 1500:
        if sea_meters >= 1000:
            label = f"{round(sea_meters / 1000, 1)} км до моря"
        else:
            label = f"{sea_meters} м до моря"
        flags.append({
            "type": "far_sea",
            "severity": "info",
            "label": label,
        })

    if _profile_has_small_kid(client_profile):
        kid_unfriendly = (
            (rating and rating < 4.2)
            or bool(card.get("night_flight"))
            or (sea_meters and sea_meters > 1500)
        )
        if kid_unfriendly:
            flags.append({
                "type": "kid_unfriendly",
                "severity": "warning",
                "label": "С малышом — спорно",
            })

    if _profile_wants_quiet(client_profile):
        meal = (card.get("meal_description") or "").lower()
        if any(t in meal for t in ("club", "party", "anim", "discо", "диско")):
            flags.append({
                "type": "not_quiet",
                "severity": "info",
                "label": "Активная инфраструктура",
            })

    return flags


def _hotel_to_card(
    hotel: Dict[str, Any],
    position: int,
    *,
    client_profile: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    tours = hotel.get("tours", {}).get("tour", []) if isinstance(hotel.get("tours"), dict) else hotel.get("tours") or []
    if isinstance(tours, dict):
        tours = [tours]
    if not tours:
        return None

    def _price(t: Dict[str, Any]) -> int:
        return _coerce_int(t.get("price"), default=10**12)

    cheapest = sorted(tours, key=_price)[0]

    fly = _coerce_str(cheapest.get("flydate"))
    nights = _coerce_int(cheapest.get("nights"))
    date_to = ""
    if fly and nights:
        try:
            d_from = datetime.strptime(fly, "%d.%m.%Y")
            date_to = (d_from + timedelta(days=nights)).strftime("%d.%m.%Y")
        except ValueError:
            date_to = ""

    image_url = (
        hotel.get("picturelink")
        or cheapest.get("hotelpicturebig")
        or cheapest.get("hotelpicturemedium")
        or cheapest.get("hotelpicturesmall")
        or ""
    )
    image_url = _normalize_url(image_url)

    sea = hotel.get("seadistance")
    sea_text = None
    if sea:
        try:
            meters = int(sea)
            if meters >= 1000:
                sea_text = f"{round(meters / 1000, 1)} км до моря"
            else:
                sea_text = f"{meters} м до моря"
        except (TypeError, ValueError):
            sea_text = str(sea)

    sea_meters_int: Optional[int] = None
    if sea is not None:
        try:
            sea_meters_int = int(sea)
        except (TypeError, ValueError):
            sea_meters_int = None

    card = {
        "hotel_name": _coerce_str(hotel.get("hotelname")) or "Отель",
        "hotel_stars": _coerce_int(hotel.get("hotelstars")),
        "hotel_rating": _coerce_str(hotel.get("hotelrating")) or "0",
        "country": _coerce_str(hotel.get("countryname")) or "—",
        "resort": _coerce_str(hotel.get("regionname")) or _coerce_str(hotel.get("subregionname")),
        "price": _coerce_int(cheapest.get("price")),
        "currency": _coerce_str(cheapest.get("currency")) or "RUB",
        "date_from": fly,
        "date_to": date_to,
        "nights": nights,
        "meal_code": _coerce_str(cheapest.get("meal")),
        "meal_description": _coerce_str(cheapest.get("mealrussian")) or _coerce_str(cheapest.get("meal")),
        "room_type": _coerce_str(cheapest.get("room")),
        "placement": _coerce_str(cheapest.get("placement")),
        "adults": _coerce_int(cheapest.get("adults"), default=2),
        "children": _coerce_int(cheapest.get("child"), default=0),
        "departure_city": "—",
        "operator": _coerce_str(cheapest.get("operatorname")),
        "flight_included": True,
        "tour_id": _coerce_str(cheapest.get("tourid")) or f"tv-{position}",
        "hotel_code": _coerce_int(hotel.get("hotelcode")) or None,
        "hotel_link": _coerce_str(hotel.get("fulldesclink")) or None,
        "image_url": image_url,
        "sea_distance": sea_text,
        "on_request": bool(_coerce_int(cheapest.get("onrequest"))),
        "flight_status": _coerce_int(cheapest.get("flightstatus")),
        "hotel_status": _coerce_int(cheapest.get("hotelstatus")),
        "night_flight": _coerce_int(cheapest.get("nightflight")),
        "promo": bool(_coerce_int(cheapest.get("promo"))),
        "is_hot_tour": False,
        "_position": position,
        "_warning": None,
    }
    card["flags"] = _compute_card_flags(card, client_profile, sea_distance_meters=sea_meters_int)
    return card


def _hotot_to_card(
    hot: Dict[str, Any],
    position: int,
    *,
    client_profile: Optional[str] = None,
) -> Dict[str, Any]:
    """Map get_hot_tours item to TourCard."""
    fly = _coerce_str(hot.get("flydate"))
    nights = _coerce_int(hot.get("nights"))
    card = {
        "hotel_name": _coerce_str(hot.get("hotelname")) or "Отель",
        "hotel_stars": _coerce_int(hot.get("hotelstars")),
        "hotel_rating": _coerce_str(hot.get("hotelrating")) or "0",
        "country": _coerce_str(hot.get("countryname")) or "—",
        "resort": _coerce_str(hot.get("hotelregionname")),
        "price": _coerce_int(hot.get("price")),
        "currency": _coerce_str(hot.get("currency")) or "RUB",
        "date_from": fly,
        "date_to": "",
        "nights": nights,
        "meal_code": _coerce_str(hot.get("meal")),
        "meal_description": _coerce_str(hot.get("mealrussian")) or _coerce_str(hot.get("meal")),
        "placement": _coerce_str(hot.get("placement")),
        "adults": _coerce_int(hot.get("adults"), default=2),
        "children": _coerce_int(hot.get("child")),
        "operator": _coerce_str(hot.get("operatorname")),
        "tour_id": _coerce_str(hot.get("tourid")) or f"hot-{position}",
        "hotel_code": _coerce_int(hot.get("hotelcode")) or None,
        "hotel_link": _coerce_str(hot.get("fulldesclink")) or None,
        "image_url": _normalize_url(_coerce_str(hot.get("hotelpicture"))),
        "is_hot_tour": True,
        "_position": position,
        "_warning": "Горящий тур: цена за человека, проверяйте размещение.",
    }
    card["flags"] = _compute_card_flags(card, client_profile)
    return card


def _hotel_info_to_frontend(hotel: Dict[str, Any]) -> Dict[str, Any]:
    images_raw = hotel.get("images") or hotel.get("imageurls") or []
    if isinstance(images_raw, dict):
        images_raw = list(images_raw.values())
    if isinstance(images_raw, list):
        flattened: List[Any] = []
        for it in images_raw:
            if isinstance(it, list):
                flattened.extend(it)
            elif isinstance(it, dict):
                # Tourvisor sometimes returns {"image": [url, url]} or {"image": url}
                inner = it.get("image") or it.get("url") or it.get("src")
                if isinstance(inner, list):
                    flattened.extend(inner)
                elif inner:
                    flattened.append(inner)
            else:
                flattened.append(it)
        images_raw = flattened
    images = [_normalize_url(img) for img in images_raw if img]
    return {
        "name": _coerce_str(hotel.get("name")),
        "stars": _coerce_int(hotel.get("stars")),
        "rating": _coerce_str(hotel.get("rating")),
        "country": _coerce_str(hotel.get("country")),
        "region": _coerce_str(hotel.get("region")),
        "seadistance": _coerce_str(hotel.get("placement")) or "уточнить",
        "build": _coerce_str(hotel.get("build")),
        "repair": _coerce_str(hotel.get("repair")),
        "square": _coerce_str(hotel.get("square")),
        "phone": _coerce_str(hotel.get("phone")),
        "site": _coerce_str(hotel.get("site")),
        "placement": _coerce_str(hotel.get("placement")),
        "description": _strip_html(hotel.get("description")),
        "territory": _strip_html(hotel.get("territory")),
        "beach": _strip_html(hotel.get("beach")),
        "child": _strip_html(hotel.get("child")),
        "inroom": _strip_html(hotel.get("inroom")),
        "roomtypes": _strip_html(hotel.get("roomtypes")),
        "services": _strip_html(hotel.get("services")),
        "servicefree": _strip_html(hotel.get("servicefree")),
        "servicepay": _strip_html(hotel.get("servicepay")),
        "meallist": _coerce_str(hotel.get("meallist")),
        "mealtypes": _strip_html(hotel.get("mealtypes")),
        "animation": _strip_html(hotel.get("animation")),
        "images": images,
        "images_count": _coerce_int(hotel.get("imagescount"), default=len(images)),
        "coordinates": {
            "lat": _coerce_str(hotel.get("coord1")),
            "lon": _coerce_str(hotel.get("coord2")),
        },
        "reviews": [
            {
                "name": _coerce_str(rev.get("Name") or rev.get("name")),
                "rate": float(_coerce_int(rev.get("Rate") or rev.get("rate"))),
                "content": _coerce_str(rev.get("Content") or rev.get("content")),
                "traveltime": _coerce_str(rev.get("Traveltime") or rev.get("traveltime")),
            }
            for rev in _normalize_reviews(hotel.get("reviews"))
            if isinstance(rev, dict)
        ],
        "reviews_count": _coerce_int(hotel.get("reviewscount") or hotel.get("reviews_count")),
    }


def _flight_segment(segment: Dict[str, Any]) -> Dict[str, Any]:
    company = segment.get("company") or {}
    departure = segment.get("departure") or {}
    arrival = segment.get("arrival") or {}
    dep_port = departure.get("port") or {}
    arr_port = arrival.get("port") or {}
    if isinstance(dep_port, str):
        dep_port = {"id": "", "name": dep_port}
    if isinstance(arr_port, str):
        arr_port = {"id": "", "name": arr_port}

    def _airport_name(port_obj: Dict[str, Any]) -> str:
        return _coerce_str(port_obj.get("name")) or _coerce_str(port_obj.get("shortName"))

    return {
        "number": _coerce_str(segment.get("number")),
        "airline": _coerce_str(company.get("name")),
        "airline_code": _coerce_str(company.get("id")),
        "airline_logo": _coerce_str(company.get("logo") or company.get("thumb")),
        "departure_date": _coerce_str(departure.get("date")) or _coerce_str(segment.get("dateforward")),
        "departure_time": _coerce_str(departure.get("time")),
        "departure_airport": _airport_name(dep_port),
        "departure_airport_code": _coerce_str(dep_port.get("id")),
        "arrival_date": _coerce_str(arrival.get("date")),
        "arrival_time": _coerce_str(arrival.get("time")),
        "arrival_airport": _airport_name(arr_port),
        "arrival_airport_code": _coerce_str(arr_port.get("id")),
        "flight_class": _coerce_str(segment.get("class")) or "Y",
        "baggage": _coerce_str(segment.get("baggage")) or None,
        "carry_on": _coerce_str(segment.get("carryOn")) or None,
        "on_demand": bool(segment.get("onDemand")),
        "no_places": bool(segment.get("noPlaces")),
    }


def _flights_to_frontend(actdetail: Dict[str, Any]) -> Dict[str, Any]:
    if not isinstance(actdetail, dict):
        return {"flights": []}
    # Tourvisor actdetail.php wraps payload in "data".
    if "flights" not in actdetail and isinstance(actdetail.get("data"), dict):
        actdetail = actdetail["data"]
    flights_block = (actdetail or {}).get("flights") or []
    if isinstance(flights_block, dict):
        flights_block = [flights_block]
    out: List[Dict[str, Any]] = []
    for opt in flights_block:
        forward_raw = opt.get("forward") or []
        backward_raw = opt.get("backward") or []
        if isinstance(forward_raw, dict):
            forward_raw = [forward_raw]
        if isinstance(backward_raw, dict):
            backward_raw = [backward_raw]
        price_block = opt.get("price") or {}
        fuel_block = opt.get("fuelcharge") or {}
        out.append(
            {
                "forward": [_flight_segment(seg) for seg in forward_raw if isinstance(seg, dict)],
                "backward": [_flight_segment(seg) for seg in backward_raw if isinstance(seg, dict)],
                "date_forward": _coerce_str(opt.get("dateforward")),
                "date_backward": _coerce_str(opt.get("datebackward")),
                "price": _coerce_int(price_block.get("value")),
                "currency": _coerce_str(price_block.get("currency")) or "RUB",
                "fuel_charge": _coerce_int(fuel_block.get("value")) or 0,
                "is_default": bool(opt.get("isdefault")),
            }
        )
    return {"flights": out}


# ────────────────────────────────────────────────────────────────────
# Tool dispatch
# ────────────────────────────────────────────────────────────────────


def _summarize_hotel_for_llm(hotel: Dict[str, Any]) -> Dict[str, Any]:
    """Lean summary fed back to the LLM - smaller payload = faster reasoning."""
    tours = hotel.get("tours", {}).get("tour", []) if isinstance(hotel.get("tours"), dict) else hotel.get("tours") or []
    if isinstance(tours, dict):
        tours = [tours]
    cheap = min(tours, key=lambda t: _coerce_int(t.get("price"), 10**12)) if tours else {}
    return {
        "name": _coerce_str(hotel.get("hotelname")),
        "stars": _coerce_int(hotel.get("hotelstars")),
        "rating": _coerce_str(hotel.get("hotelrating")),
        "region": _coerce_str(hotel.get("regionname")),
        "price": _coerce_int(cheap.get("price")),
        "nights": _coerce_int(cheap.get("nights")),
        "flydate": _coerce_str(cheap.get("flydate")),
        "meal": _coerce_str(cheap.get("mealrussian")) or _coerce_str(cheap.get("meal")),
        "operator": _coerce_str(cheap.get("operatorname")),
        "tourid": _coerce_str(cheap.get("tourid")),
        "hotelcode": _coerce_int(hotel.get("hotelcode")),
        "onrequest": bool(_coerce_int(cheap.get("onrequest"))),
    }


def _demo_search(args: Dict[str, Any], session: CopilotSession) -> Dict[str, Any]:
    """Synthetic search for DEMO mode (no Tourvisor credentials)."""
    country_code = _coerce_int(args.get("country")) or None
    max_price = _coerce_int(args.get("priceto")) or None
    min_stars = _coerce_int(args.get("stars")) or None
    family = bool(_coerce_int(args.get("child"), 0))
    adults_only_ok = not family
    selected = filter_demo_hotels(
        country_code=country_code,
        max_price=max_price,
        min_stars=min_stars,
        family=family,
        adults_only_ok=adults_only_ok,
        limit=8,
    )
    cards = [demo_hotel_to_card(hotel, idx + 1) for idx, hotel in enumerate(selected)]
    for card in cards:
        card["flags"] = _compute_card_flags(card, session.client_profile)
    request_id = f"demo-{uuid.uuid4().hex[:8]}"
    session.last_search_request_id = request_id
    session.last_search_params = dict(args)
    session.last_cards = cards
    session.last_hotels = selected
    return {
        "requestid": request_id,
        "mode": "demo",
        "hotels_found": len(cards),
        "min_price": cards[0]["price"] if cards else 0,
        "message": (
            "Tourvisor не подключён (нет TOURVISOR_AUTH_LOGIN/PASS) — отдаю demo-подборку из встроенного "
            "каталога: можно показать клиенту, потом переключиться на реальный API."
        ),
    }


async def _tool_search_tours(client: TourVisorClient, args: Dict[str, Any], session: CopilotSession) -> Dict[str, Any]:
    # ── 6-slot cascade gate ─────────────────────────────────────────
    # Блокируем search_tours, пока агент не указал критичные слоты. После блока
    # LLM получает структурированную ошибку с user_hint и должен задать ОДИН
    # уточняющий вопрос (см. backend/prompts/system_prompt_agent_copilot.md §3).
    is_follow_up = bool(session.last_search_params)
    is_complete, missing_slots = _check_cascade_slots(session.history, args, is_follow_up)
    if not is_complete:
        first_missing = missing_slots[0] if missing_slots else "уточнение"
        nudge = _NUDGE_MAP.get(first_missing, f"Уточни у агента: {first_missing}.")
        session.last_cascade_missing = first_missing
        session.last_cascade_nudge = nudge
        session.turn_intent = "cascade_block"
        # Сохраним валидные параметры в last_search_params, чтобы при следующем
        # вызове search_tours модель могла переиспользовать их (param-cache).
        for key in (
            "country", "departure", "datefrom", "dateto",
            "nightsfrom", "nightsto", "adults", "child",
            "childage1", "childage2", "childage3",
            "stars", "starsbetter", "meal", "mealbetter",
            "regions", "subregions", "hotels", "operators",
            "pricefrom", "priceto", "pricetype",
        ):
            if args.get(key) is not None and key not in session.last_search_params:
                session.last_search_params[key] = args[key]
        logger.warning(
            "[%s] cascade_blocked: missing=%s first=%s",
            session.id, missing_slots, first_missing,
        )
        return {
            "error": "cascade_incomplete",
            "missing": missing_slots,
            "first_missing": first_missing,
            "user_hint": nudge,
            "guidance": (
                "ПОИСК НЕ ЗАПУЩЕН. Не вызывай search_tours повторно с теми же параметрами. "
                "Задай агенту ровно ОДИН короткий вопрос, дословно или близко к тексту "
                "user_hint. Не пиши «карточки выше» и не перечисляй все недостающие слоты."
            ),
        }

    if not _has_tourvisor_credentials():
        result = _demo_search(args, session)
        # demo-режим: карточки сразу строятся внутри _demo_search через session.last_cards.
        session.turn_pending_cards = list(session.last_cards)
        session.turn_intent = "new_search"
        return result

    # ── Rating safety-net ───────────────────────────────────────────
    # Без явного hotels-фильтра поднимаем floor пользовательского рейтинга
    # до >=3.5 (TourVisor: rating=3 → "Хорошо и выше"). Это гарантирует, что
    # выдача не наполнится отельчиками 2.0-3.0★ из неизвестных источников.
    # Tier-сортировка по rating'у (4.3 / 4.0 / 3.8 / 3.5) применяется
    # позже в _tool_get_search_results.
    if args.get("rating") in (None, 0, "0", "") and not args.get("hotels"):
        args["rating"] = 3
        logger.info("[%s] rating-floor injected: rating=3 (>=3.5)", session.id)

    child_ages = []
    for key in ("childage1", "childage2", "childage3"):
        if args.get(key):
            child_ages.append(_coerce_int(args[key]))

    request_id = await client.search_tours(
        departure=_coerce_int(args.get("departure"), 1),
        country=_coerce_int(args.get("country")),
        date_from=args.get("datefrom"),
        date_to=args.get("dateto"),
        nights_from=_coerce_int(args.get("nightsfrom"), 7),
        nights_to=_coerce_int(args.get("nightsto"), 10),
        adults=_coerce_int(args.get("adults"), 2),
        children=_coerce_int(args.get("child"), 0),
        child_ages=child_ages or None,
        stars=args.get("stars"),
        starsbetter=args.get("starsbetter"),
        meal=args.get("meal"),
        mealbetter=args.get("mealbetter"),
        rating=args.get("rating"),
        hotels=args.get("hotels"),
        regions=args.get("regions"),
        subregions=args.get("subregions"),
        operators=args.get("operators"),
        price_from=args.get("pricefrom"),
        price_to=args.get("priceto"),
        hotel_types=args.get("hoteltypes"),
        services=args.get("services"),
        onrequest=args.get("onrequest"),
        directflight=args.get("directflight"),
        flightclass=args.get("flightclass"),
        currency=args.get("currency"),
        pricetype=args.get("pricetype"),
        hideregular=args.get("hideregular"),
    )
    session.last_search_request_id = request_id
    session.last_search_params = dict(args)
    logger.info("[%s] search_tours -> requestid=%s", session.id, request_id)
    return {
        "requestid": request_id,
        "message": "Поиск запущен. Вызовите get_search_results для получения отелей (статус ожидается автоматически).",
    }


async def _tool_get_search_results(client: TourVisorClient, args: Dict[str, Any], session: CopilotSession) -> Dict[str, Any]:
    request_id = args.get("requestid") or session.last_search_request_id
    if not request_id:
        return {"error": "no_request_id", "message": "Сначала вызовите search_tours."}

    if request_id.startswith("demo-") or not _has_tourvisor_credentials():
        cards = session.last_cards or []
        session.turn_pending_cards = list(cards)
        session.turn_intent = "new_search"
        return {
            "requestid": request_id,
            "mode": "demo",
            "hotels_found": len(cards),
            "tours_found": len(cards),
            "min_price": cards[0]["price"] if cards else 0,
            "hotels": [
                {
                    "hotelcode": card.get("hotel_code"),
                    "hotelname": card.get("hotel_name"),
                    "stars": card.get("hotel_stars"),
                    "rating": card.get("hotel_rating"),
                    "country": card.get("country"),
                    "region": card.get("resort"),
                    "price": card.get("price"),
                    "currency": card.get("currency"),
                    "nights": card.get("nights"),
                    "flydate": card.get("date_from"),
                    "meal": card.get("meal_description"),
                    "operator": card.get("operator"),
                    "tourid": card.get("tour_id"),
                    "tours_total": 1,
                    "onrequest": False,
                    "hotelstatus": 2,
                    "flightstatus": 0,
                }
                for card in cards
            ],
            "note": "Карточки уже в UI. Это demo-подборка; для живого API подключите TOURVISOR_AUTH_LOGIN/PASS.",
        }

    try:
        result = await client.wait_for_search(request_id, max_wait=int(os.getenv("SEARCH_MAX_WAIT", "30")), early_return_hotels=4)
    except NoResultsError as exc:
        session.last_hotels = []
        session.last_cards = []
        session.turn_pending_cards = []
        session.turn_intent = "new_search"
        return {"hotels_found": 0, "message": str(exc), "filters_hint": getattr(exc, "filters_hint", None)}
    except SearchNotFoundError:
        return {"error": "request_not_found", "message": "Поиск устарел, нужен новый search_tours."}

    hotels = result.get("result", {}).get("hotel", [])
    if isinstance(hotels, dict):
        hotels = [hotels]
    status = result.get("status", {})
    session.last_hotels = hotels

    # ── Rating-tier post-selection (port from mgp_v2 §3.3) ─────────
    # API уже отфильтровал rating>=3.5. Дополнительно сортируем отели
    # по tier'ам пользовательского рейтинга, чтобы топ выдачи был с
    # лучшими отзывами. Внутри тира — сохраняем порядок API (уже
    # отсортировано по цене).
    def _hotel_rating_value(h: Dict[str, Any]) -> float:
        try:
            return float(h.get("hotelrating") or 0)
        except (TypeError, ValueError):
            return 0.0

    rating_tiers = (4.3, 4.0, 3.8, 3.5, 0.0)
    selected_hotels: List[Dict[str, Any]] = []
    seen_idx: set = set()
    tier_counts: List[int] = []
    for threshold in rating_tiers:
        before = len(selected_hotels)
        if before >= 8:
            break
        for idx, hotel in enumerate(hotels):
            if idx in seen_idx:
                continue
            if _hotel_rating_value(hotel) >= threshold or threshold == 0.0:
                selected_hotels.append(hotel)
                seen_idx.add(idx)
                if len(selected_hotels) >= 8:
                    break
        tier_counts.append(len(selected_hotels) - before)
    if hotels and selected_hotels != hotels[: len(selected_hotels)]:
        logger.info(
            "[%s] rating-tiers: %s (4.3+/4.0+/3.8+/3.5+/other) total=%d",
            session.id, tier_counts, len(hotels),
        )

    session.last_cards = []
    cards: List[Dict[str, Any]] = []
    for idx, hotel in enumerate(selected_hotels[:8]):
        card = _hotel_to_card(hotel, idx + 1, client_profile=session.client_profile)
        if card:
            cards.append(card)
    session.last_cards = cards
    session.turn_pending_cards = list(cards)
    session.turn_intent = "new_search"
    summary_limit = int(os.getenv("LLM_HOTEL_SUMMARY_LIMIT", "5"))
    summary = [_summarize_hotel_for_llm(hotel) for hotel in selected_hotels[:summary_limit]]
    return {
        "requestid": request_id,
        "hotels_found": _coerce_int(status.get("hotelsfound")),
        "tours_found": _coerce_int(status.get("toursfound")),
        "min_price": _coerce_int(status.get("minprice")),
        "top_hotels": summary,
        "note": "Карточки уже в UI. Прокомментируй коротко.",
    }


_HOTEL_INFO_TTL_SEC = 30 * 60  # 30 минут — описание отеля живёт долго


async def _tool_get_hotel_info(client: TourVisorClient, args: Dict[str, Any], session: CopilotSession) -> Dict[str, Any]:
    code = _coerce_int(args.get("hotelcode"))
    if not code:
        return {"error": "no_hotel_code"}
    # ВАЖНО: get_hotel_info НЕ трогает session.turn_pending_cards и session.last_cards.
    # После этого вызова frontend получит tour_cards=[], правая панель сохранит
    # выдачу из последнего search_tours/get_hot_tours, а в чате под ответом ассистента
    # карточек НЕ будет (это и решает баг «после вопроса про отель снова те же карточки»).
    session.turn_intent = "hotel_info"

    cached = _cache_get(session.hotel_info_cache, str(code), _HOTEL_INFO_TTL_SEC)
    if cached is not None:
        return {**cached, "_cache_hit": True}

    if not _has_tourvisor_credentials():
        for hotel in DEMO_HOTELS:
            if hotel["hotel_code"] == code:
                front = demo_hotel_to_info(hotel)
                payload = {
                    "hotelcode": code,
                    "name": front["name"],
                    "stars": front["stars"],
                    "rating": front["rating"],
                    "region": front["region"],
                    "country": front["country"],
                    "description": front["description"][:600],
                    "beach": front["beach"][:240],
                    "child": front["child"][:240],
                    "meallist": front["meallist"],
                    "images_count": front["images_count"],
                    "first_image": (front["images"][0] if front["images"] else None),
                    "mode": "demo",
                }
                _cache_put(session.hotel_info_cache, str(code), payload)
                return payload
        return {"error": "demo_hotel_not_found", "hotelcode": code}
    hotel = await client.get_hotel_info(
        hotel_code=code,
        big_images=bool(_coerce_int(args.get("imgbig"))),
        remove_tags=bool(_coerce_int(args.get("removetags"), default=1)),
        include_reviews=bool(_coerce_int(args.get("reviews"))),
    )
    front = _hotel_info_to_frontend(hotel)
    payload = {
        "hotelcode": code,
        "name": front["name"],
        "stars": front["stars"],
        "rating": front["rating"],
        "region": front["region"],
        "country": front["country"],
        "description": front["description"][:600],
        "beach": front["beach"][:240],
        "child": front["child"][:240],
        "meallist": front["meallist"],
        "images_count": front["images_count"],
        "first_image": (front["images"][0] if front["images"] else None),
    }
    _cache_put(session.hotel_info_cache, str(code), payload)
    return payload


async def _tool_get_dictionaries(client: TourVisorClient, args: Dict[str, Any], session: CopilotSession) -> Dict[str, Any]:
    dict_type = args.get("type")
    if not dict_type:
        return {"error": "no_type"}
    if not _has_tourvisor_credentials():
        return {
            "type": dict_type,
            "mode": "demo",
            "message": (
                "Tourvisor не подключён, но в демо-режиме коды стран/курортов уже зашиты в системный "
                "промпт. Используй их напрямую (Турция=4, Египет=1, ОАЭ=9, Таиланд=2)."
            ),
            "items": [],
        }
    cndep = _coerce_int(args.get("cndep")) or None
    regcountry = _coerce_int(args.get("regcountry")) or None
    flydeparture = _coerce_int(args.get("flydeparture")) or None
    flycountry = _coerce_int(args.get("flycountry")) or None

    if dict_type == "country":
        items = await client.get_countries(departure_id=cndep)
    elif dict_type == "departure":
        items = await client.get_departures()
    elif dict_type == "region":
        if not regcountry:
            return {"error": "regcountry_required", "message": "Для type=region укажите regcountry."}
        items = await client.get_regions(country_id=regcountry)
    elif dict_type == "subregion":
        if not regcountry:
            return {"error": "regcountry_required", "message": "Для type=subregion укажите regcountry."}
        items = await client.get_subregions(country_id=regcountry)
    elif dict_type == "meal":
        items = await client.get_meals()
    elif dict_type == "stars":
        items = await client.get_stars()
    elif dict_type == "operator":
        items = await client.get_operators(departure_id=flydeparture, country_id=flycountry)
    elif dict_type == "flydate":
        if not (flydeparture and flycountry):
            return {"error": "flydate_required", "message": "flydeparture и flycountry обязательны."}
        items = await client.get_flydates(departure_id=flydeparture, country_id=flycountry)
    else:
        return {"error": f"unknown_type:{dict_type}"}
    items = items if isinstance(items, list) else [items]
    return {"type": dict_type, "count": len(items), "items": items[:60]}


async def _tool_get_hot_tours(client: TourVisorClient, args: Dict[str, Any], session: CopilotSession) -> Dict[str, Any]:
    if not _has_tourvisor_credentials():
        # In demo mode treat hot tours as the same demo catalog with discount marker.
        countries_arg = _coerce_str(args.get("countries"))
        country_code = None
        if countries_arg:
            try:
                country_code = int(countries_arg.split(",")[0])
            except ValueError:
                country_code = None
        selected = filter_demo_hotels(country_code=country_code, limit=6)
        cards = []
        for idx, hotel in enumerate(selected):
            card = demo_hotel_to_card(hotel, idx + 1)
            card["is_hot_tour"] = True
            card["old_price"] = int(card["price"] * 1.25)
            card["discount_percent"] = 20
            card["price"] = int(card["price"] * 0.8)
            card["flags"] = _compute_card_flags(card, session.client_profile)
            cards.append(card)
        session.last_cards = cards
        session.turn_pending_cards = list(cards)
        session.turn_intent = "hot_tours"
        return {
            "count": len(cards),
            "tours": [
                {
                    "hotelname": card["hotel_name"],
                    "country": card["country"],
                    "region": card["resort"],
                    "stars": card["hotel_stars"],
                    "price": card["price"],
                    "currency": card["currency"],
                    "flydate": card["date_from"],
                    "nights": card["nights"],
                    "tourid": card["tour_id"],
                }
                for card in cards
            ],
            "mode": "demo",
            "note": "Demo-горящие туры. Подключите Tourvisor для реальных горящих предложений.",
        }
    items = await client.get_hot_tours(
        city=_coerce_int(args.get("city"), 1),
        count=_coerce_int(args.get("items"), 8),
        countries=args.get("countries"),
        regions=args.get("regions"),
        operators=args.get("operators"),
        datefrom=args.get("datefrom"),
        dateto=args.get("dateto"),
        stars=args.get("stars"),
        meal=args.get("meal"),
        rating=args.get("rating"),
        max_days=args.get("maxdays"),
        tour_type=_coerce_int(args.get("tourtype"), 0),
        visa_free=bool(_coerce_int(args.get("visa"))),
        sort_by_price=bool(_coerce_int(args.get("sort"))),
        picturetype=_coerce_int(args.get("picturetype"), 1),
        currency=_coerce_int(args.get("currency"), 0),
    )
    cards = [
        _hotot_to_card(item, idx + 1, client_profile=session.client_profile)
        for idx, item in enumerate(items[:8])
        if isinstance(item, dict)
    ]
    session.last_cards = cards
    session.turn_pending_cards = list(cards)
    session.turn_intent = "hot_tours"
    summary = [
        {
            "hotelname": _coerce_str(it.get("hotelname")),
            "country": _coerce_str(it.get("countryname")),
            "region": _coerce_str(it.get("hotelregionname")),
            "stars": _coerce_int(it.get("hotelstars")),
            "price": _coerce_int(it.get("price")),
            "currency": _coerce_str(it.get("currency")) or "RUB",
            "flydate": _coerce_str(it.get("flydate")),
            "nights": _coerce_int(it.get("nights")),
            "tourid": _coerce_str(it.get("tourid")),
        }
        for it in items[:8]
        if isinstance(it, dict)
    ]
    return {"count": len(summary), "tours": summary, "note": "Карточки уже добавлены в UI."}


async def _tool_continue_search(client: TourVisorClient, args: Dict[str, Any], session: CopilotSession) -> Dict[str, Any]:
    request_id = args.get("requestid") or session.last_search_request_id
    if not request_id:
        return {"error": "no_request_id"}
    info = await client.continue_search(request_id)
    return {"requestid": request_id, "page": info.get("page")}


# ──────────────────────────────────────────────────────────────────────
# Агентские tool-ы §7.5.9 / §7.5.10
#
# get_tour_details (actdetail.php) и actualize_tour (actualize.php) — дорогие
# вызовы (тратят дневной лимит TourVisor). Поэтому:
#   * результаты кэшируются в session.tour_details_cache (TTL 60 мин) и
#     session.actualize_cache (TTL 5 мин — цена живёт недолго);
#   * жёсткий лимит на ход: details ≤1, actualize ≤2 (см. план §2.2/§2.3).
#   * НИ ОДИН из них не модифицирует session.turn_pending_cards: tools-info, а
#     не tools-выдача — иначе сломаем механизм per-turn-cards.
# ──────────────────────────────────────────────────────────────────────

_TOUR_DETAILS_TTL_SEC = 60 * 60        # 60 минут
_ACTUALIZE_TTL_SEC = 5 * 60            # 5 минут
_TOUR_DETAILS_LIMIT_PER_TURN = 1
_ACTUALIZE_LIMIT_PER_TURN = 2


def _cache_get(cache: Dict[str, Dict[str, Any]], key: str, ttl_sec: int) -> Optional[Dict[str, Any]]:
    if not key:
        return None
    entry = cache.get(key)
    if not entry:
        return None
    ts = entry.get("ts") or 0
    if time.time() - ts > ttl_sec:
        cache.pop(key, None)
        return None
    return entry.get("data")


def _cache_put(cache: Dict[str, Dict[str, Any]], key: str, data: Dict[str, Any]) -> None:
    if not key:
        return
    cache[key] = {"data": data, "ts": time.time()}


def _segments_to_compact(segments: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Сжать список сегментов рейса до 1-строчного описания для LLM."""
    if not segments:
        return {}
    first = segments[0] or {}
    last = segments[-1] or first
    return {
        "airline": first.get("airline") or last.get("airline") or "",
        "dep_time": first.get("departure_time") or "",
        "dep_airport": first.get("departure_airport_code") or "",
        "arr_time": last.get("arrival_time") or "",
        "arr_airport": last.get("arrival_airport_code") or "",
        "stops": max(0, len(segments) - 1),
        "baggage": first.get("baggage") or "",
        "carry_on": first.get("carry_on") or "",
    }


def _addpayments_compact(payload: Dict[str, Any]) -> List[Dict[str, Any]]:
    raw = (payload or {}).get("addpayments") or []
    if isinstance(raw, dict):
        raw = [raw]
    out: List[Dict[str, Any]] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        amount = _coerce_int(item.get("amount") or item.get("value"))
        if amount is None:
            continue
        out.append({
            "name": _coerce_str(item.get("name") or item.get("title"))[:40],
            "amount": amount,
            "currency": _coerce_str(item.get("currency")) or "RUB",
            "mandatory": bool(item.get("mandatory") or item.get("required")),
        })
    return out[:6]


def _not_included_compact(payload: Dict[str, Any]) -> List[str]:
    out: List[str] = []
    for key, label in (
        ("notransfer", "трансфер"),
        ("nomedinsurance", "мед.страховка"),
        ("noflight", "перелёт"),
        ("nomeal", "питание"),
    ):
        val = payload.get(key)
        try:
            if int(val) == 1:
                out.append(label)
        except (TypeError, ValueError):
            continue
    return out


async def _tool_get_tour_details(
    client: TourVisorClient, args: Dict[str, Any], session: CopilotSession
) -> Dict[str, Any]:
    """§7.5.9 «Что входит в цену» — actdetail.php c кэшем и жёстким лимитом."""
    tour_id = _coerce_str(args.get("tourid")) or _coerce_str(args.get("tour_id"))
    if not tour_id:
        return {"error": "no_tour_id", "message": "Нужен tourid (из карточки тура)."}

    used = session.tools_used_this_turn.get("get_tour_details", 0)
    if used >= _TOUR_DETAILS_LIMIT_PER_TURN:
        # Страховка от LLM-петли: запрашивать details для нескольких туров за один
        # ход слишком дорого (см. план: ≤1/ход).
        return {
            "error": "tour_details_quota_exceeded",
            "message": (
                "За один ход я могу проверить детали только одного тура. "
                "Уточни у агента, по какому именно туру нужны рейсы и что входит в цену."
            ),
        }
    session.tools_used_this_turn["get_tour_details"] = used + 1
    session.turn_intent = "tour_details"

    cached = _cache_get(session.tour_details_cache, tour_id, _TOUR_DETAILS_TTL_SEC)
    if cached:
        return {**cached, "_cache_hit": True}

    if not _has_tourvisor_credentials():
        return {
            "tourid": tour_id,
            "mode": "demo",
            "message": (
                "Tourvisor не подключён — детали тура недоступны в демо-режиме. "
                "Подключите ключи, чтобы видеть рейсы и доплаты."
            ),
        }

    try:
        raw = await client.get_tour_details(tour_id=tour_id)
    except TourIdExpiredError as exc:
        return {
            "error": "tour_id_expired",
            "tourid": tour_id,
            "message": (
                str(exc)
                or "Данные тура устарели. Нужен новый поиск с теми же параметрами."
            ),
        }

    flights_payload = _flights_to_frontend(raw)
    flights_list = flights_payload.get("flights") or []
    default_flight = next((f for f in flights_list if f.get("is_default")), None) or (
        flights_list[0] if flights_list else None
    )

    flight_forward: Dict[str, Any] = {}
    flight_backward: Dict[str, Any] = {}
    night_flight = False
    fuel_charge = 0
    if default_flight:
        flight_forward = _segments_to_compact(default_flight.get("forward") or [])
        flight_backward = _segments_to_compact(default_flight.get("backward") or [])
        fuel_charge = _coerce_int(default_flight.get("fuel_charge")) or 0
        # Признак ночного перелёта: вылет туда между 23:00 и 05:59.
        dep_time = (flight_forward.get("dep_time") or "").strip()
        try:
            hour = int(dep_time.split(":")[0]) if dep_time else -1
            night_flight = hour >= 23 or 0 <= hour <= 5
        except ValueError:
            night_flight = False

    inner = raw.get("data") if isinstance(raw, dict) and isinstance(raw.get("data"), dict) else raw

    compact = {
        "tourid": tour_id,
        "flights_count": len(flights_list),
        "flight_forward": flight_forward,
        "flight_backward": flight_backward,
        "fuel_charge": fuel_charge,
        "night_flight": bool(night_flight),
        "addpayments": _addpayments_compact(inner or {}),
        "not_included": _not_included_compact(inner or {}),
    }
    _cache_put(session.tour_details_cache, tour_id, compact)
    return compact


async def _tool_actualize_tour(
    client: TourVisorClient, args: Dict[str, Any], session: CopilotSession
) -> Dict[str, Any]:
    """§7.5.10 «Актуализация цены» — actualize.php c кэшем и лимитом 2/ход."""
    tour_id = _coerce_str(args.get("tourid")) or _coerce_str(args.get("tour_id"))
    if not tour_id:
        return {"error": "no_tour_id", "message": "Нужен tourid (из карточки тура)."}

    used = session.tools_used_this_turn.get("actualize_tour", 0)
    if used >= _ACTUALIZE_LIMIT_PER_TURN:
        return {
            "error": "actualize_quota_exceeded",
            "message": (
                "За один ход я уже актуализировал две позиции. "
                "Если нужно ещё — повторим запрос в следующем сообщении."
            ),
        }
    session.tools_used_this_turn["actualize_tour"] = used + 1
    session.turn_intent = "actualize"

    cached = _cache_get(session.actualize_cache, tour_id, _ACTUALIZE_TTL_SEC)
    if cached:
        return {**cached, "_cache_hit": True}

    if not _has_tourvisor_credentials():
        return {
            "tourid": tour_id,
            "mode": "demo",
            "message": (
                "Tourvisor не подключён — актуализация недоступна в демо-режиме. "
                "Подключите ключи, чтобы получать живую цену и ссылку оператора."
            ),
        }

    request_mode = _coerce_int(args.get("request"), default=2) or 2
    currency = _coerce_int(args.get("currency"), default=0) or 0

    try:
        tour = await client.actualize_tour(
            tour_id=tour_id,
            request_mode=request_mode,
            currency=currency,
        )
    except TourIdExpiredError as exc:
        return {
            "error": "tour_id_expired",
            "tourid": tour_id,
            "message": (
                str(exc)
                or "Данные тура устарели. Нужен новый поиск с теми же параметрами."
            ),
        }

    actual_price = _coerce_int(tour.get("price"))
    old_price = _coerce_int(tour.get("priceold")) or _coerce_int(tour.get("price_old"))
    delta = None
    if actual_price is not None and old_price:
        delta = actual_price - old_price

    operator_link = _coerce_str(tour.get("operatorlink")) or _coerce_str(tour.get("operator_link"))
    visa = _coerce_int(tour.get("visacharge")) or 0
    fuel = _coerce_int(tour.get("fuelcharge")) or 0
    places_raw = tour.get("places") or tour.get("placesleft") or tour.get("placesstatus")
    places_status: Optional[str] = None
    if places_raw is not None:
        places_status = _coerce_str(places_raw)

    compact = {
        "tourid": tour_id,
        "actual_price": actual_price,
        "old_price": old_price,
        "delta": delta,
        "currency": _coerce_str(tour.get("currency")) or "RUB",
        "visa_charge": visa,
        "fuel_charge_included": fuel,
        "operator_link": operator_link or None,
        "places_status": places_status,
    }
    _cache_put(session.actualize_cache, tour_id, compact)
    return compact


async def _tool_build_collection(
    client: TourVisorClient, args: Dict[str, Any], session: CopilotSession
) -> Dict[str, Any]:
    """§7.5 «Подборка для клиента» — собрать share-ссылку из позиций last_cards.

    Аргументы:
      positions — список 1-based позиций в текущей выдаче.
      title     — заголовок подборки (≤80 симв.), опц.
      agent_note— короткая фраза для клиента, опц.

    Возвращает:
      {share_url, email_url, collection_id, count, hotel_names: [...]}.

    ВАЖНО: tool сохраняет выбранные карточки в `session.turn_pending_cards`,
    чтобы UI справа отрисовал именно те, что попали в подборку — это закрывает
    запрос «ассистент должен собрать эти карточки повторно».
    """
    positions_raw = args.get("positions") or []
    if not isinstance(positions_raw, list) or not positions_raw:
        return {
            "error": "no_positions",
            "message": (
                "Нужны позиции карточек из текущей выдачи. "
                "Пример: build_collection(positions=[1, 2, 5])."
            ),
        }
    try:
        positions = [int(p) for p in positions_raw if str(p).strip()]
    except (TypeError, ValueError):
        return {"error": "bad_positions", "message": "Позиции должны быть целыми числами."}
    positions = [p for p in positions if p >= 1]
    if not positions:
        return {"error": "bad_positions", "message": "Позиции должны быть положительными."}

    last_cards = session.last_cards or []
    if not last_cards:
        return {
            "error": "no_results",
            "message": (
                "В памяти нет карточек, чтобы собрать подборку. "
                "Сначала запусти поиск, потом выбирай позиции."
            ),
        }

    selected_cards: List[Dict[str, Any]] = []
    missing: List[int] = []
    for pos in positions:
        idx = pos - 1
        if 0 <= idx < len(last_cards):
            selected_cards.append(last_cards[idx])
        else:
            missing.append(pos)

    if not selected_cards:
        return {
            "error": "no_match",
            "message": "Ни одна указанная позиция не найдена в текущей выдаче.",
            "missing": missing,
            "available": len(last_cards),
        }

    if len(selected_cards) > 12:
        selected_cards = selected_cards[:12]

    title = (args.get("title") or "").strip() or "Подборка туров"
    if len(title) > 80:
        title = title[:80].rstrip() + "…"
    agent_note = (args.get("agent_note") or "").strip()

    cards_payload = [_share_card_payload(c) for c in selected_cards]
    _purge_expired_collections()

    collection_id = uuid.uuid4().hex[:12]
    COLLECTIONS[collection_id] = {
        "id": collection_id,
        "created_ts": time.time(),
        "cards": cards_payload,
        "title": title,
        "agent_note": agent_note,
        "client_profile": session.client_profile,
    }

    base_url = (request.host_url or "http://127.0.0.1:8080/").rstrip("/")
    share_url = f"{base_url}/share/{collection_id}"
    email_url = f"{base_url}/share/{collection_id}/email"

    # Подсветим в правой панели именно те карточки, что попали в подборку,
    # с пометкой «collection_pos» для FE — но фронт это поле игнорирует;
    # достаточно того, что сама выборка перевыставлена.
    session.turn_pending_cards = list(selected_cards)
    session.turn_intent = "comparison"

    response = {
        "collection_id": collection_id,
        "share_url": share_url,
        "email_url": email_url,
        "count": len(selected_cards),
        "hotel_names": [c.get("hotel_name") for c in selected_cards],
        "missing_positions": missing,
        "title": title,
    }
    return response


def _tool_current_date(_client, _args, _session) -> Dict[str, Any]:
    today = datetime.now()
    nearest_from = today + timedelta(days=14)
    nearest_to = nearest_from + timedelta(days=7)
    return {
        "today": today.strftime("%d.%m.%Y"),
        "iso": today.date().isoformat(),
        "weekday": ["пн", "вт", "ср", "чт", "пт", "сб", "вс"][today.weekday()],
        "default_search_window": {
            "from": nearest_from.strftime("%d.%m.%Y"),
            "to": nearest_to.strftime("%d.%m.%Y"),
        },
    }


ToolFn = Callable[[TourVisorClient, Dict[str, Any], CopilotSession], Awaitable[Dict[str, Any]]]


TOOL_DISPATCH: Dict[str, ToolFn] = {
    "search_tours": _tool_search_tours,
    "get_search_results": _tool_get_search_results,
    "get_hotel_info": _tool_get_hotel_info,
    "get_dictionaries": _tool_get_dictionaries,
    "get_hot_tours": _tool_get_hot_tours,
    "continue_search": _tool_continue_search,
    "get_tour_details": _tool_get_tour_details,
    "actualize_tour": _tool_actualize_tour,
    "build_collection": _tool_build_collection,
}


async def _run_tool(name: str, args_str: str, session: CopilotSession) -> str:
    try:
        args = json.loads(args_str or "{}")
    except json.JSONDecodeError:
        args = {}
    if not isinstance(args, dict):
        args = {}

    try:
        if name == "get_current_date":
            payload = _tool_current_date(None, args, session)
        elif name in TOOL_DISPATCH:
            client = TourVisorClient()
            payload = await TOOL_DISPATCH[name](client, args, session)
            await client.close()
        else:
            payload = {"error": f"unknown_tool:{name}"}
    except (TourVisorAPIError, TourIdExpiredError, NoResultsError, SearchNotFoundError) as exc:
        payload = {"error": exc.__class__.__name__, "message": str(exc)}
    except TourVisorError as exc:
        payload = _format_tourvisor_error(exc)
    except Exception as exc:  # pragma: no cover - defensive
        logger.exception("Tool %s failed", name)
        payload = _format_tourvisor_error(exc, fallback_error="tool_exception")

    try:
        return json.dumps(payload, ensure_ascii=False)
    except (TypeError, ValueError):
        return json.dumps({"error": "tool_response_serialize_failed"}, ensure_ascii=False)


# ────────────────────────────────────────────────────────────────────
# Agent loop
# ────────────────────────────────────────────────────────────────────


def _serialize_tool_calls(message_obj) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    for tc in (message_obj.tool_calls or []):
        out.append(
            {
                "id": tc.id,
                "type": "function",
                "function": {
                    "name": tc.function.name,
                    "arguments": tc.function.arguments or "{}",
                },
            }
        )
    return out


def _parse_intent_demo(text: str) -> Dict[str, Any]:
    """Tiny rule-based intent parser for DEMO mode (no LLM key)."""
    lowered = text.lower()
    out: Dict[str, Any] = {"raw": text}
    country_code = detect_country_code(text)
    if country_code:
        out["country"] = country_code

    budget_match = re.search(r"(\d{2,4})\s*(к|тыс|тысяч|000)", lowered)
    if budget_match:
        amount = int(budget_match.group(1))
        if budget_match.group(2) in {"к", "тыс", "тысяч"}:
            amount *= 1000
        elif budget_match.group(2) == "000":
            amount *= 1000
        out["priceto"] = amount
    else:
        big_budget = re.search(r"до\s+(\d{3,7})", lowered)
        if big_budget:
            out["priceto"] = int(big_budget.group(1))

    stars_match = re.search(r"(3|4|5)\s*[★*]|(3|4|5)[\s-]*(зв|звёзд|stars)", lowered)
    if stars_match:
        digit = stars_match.group(1) or stars_match.group(2)
        if digit:
            out["stars"] = int(digit)
            if "и выше" in lowered or "+" in lowered or "-" in lowered:
                out["starsbetter"] = 1
    nights_match = re.search(r"(\d{1,2})\s*[\-–]\s*(\d{1,2})\s*ноч", lowered)
    if nights_match:
        out["nightsfrom"] = int(nights_match.group(1))
        out["nightsto"] = int(nights_match.group(2))
    else:
        n_match = re.search(r"(\d{1,2})\s*ноч", lowered)
        if n_match:
            out["nightsfrom"] = int(n_match.group(1))
            out["nightsto"] = int(n_match.group(1))
    if any(word in lowered for word in ["семья", "ребёнк", "ребенк", "дети", "детьм"]):
        out["child"] = 1
    if "горящ" in lowered or "спецпредл" in lowered:
        out["intent"] = "hot"
    return out


def _run_demo_agent(session: CopilotSession, user_message: str) -> Dict[str, Any]:
    intent = _parse_intent_demo(user_message)

    if intent.get("intent") == "hot":
        cards = []
        for idx, hotel in enumerate(filter_demo_hotels(country_code=intent.get("country"), limit=6)):
            card = demo_hotel_to_card(hotel, idx + 1)
            card["is_hot_tour"] = True
            card["old_price"] = int(card["price"] * 1.25)
            card["discount_percent"] = 20
            card["price"] = int(card["price"] * 0.8)
            card["flags"] = _compute_card_flags(card, session.client_profile)
            cards.append(card)
        session.last_cards = cards
        reply_lines = [
            "Подобрал demo-горящие туры (без LLM, режим DEMO):",
            *(f"• {card['hotel_name']} {card['hotel_stars']}★ — {card['country']}, {card['resort']}, "
              f"от {card['price']:,} ₽ (-{card['discount_percent']}%)" for card in cards[:5]),
            "",
            "Чтобы запустить настоящий LLM-диалог — добавьте OPENAI_API_KEY в backend/.env.",
        ]
        return {
            "reply": "\n".join(reply_lines),
            "tour_cards": cards,
            "tool_trace": ["demo:hot_tours"],
            "source": "local_demo_fallback",
        }

    selected = filter_demo_hotels(
        country_code=intent.get("country"),
        max_price=intent.get("priceto"),
        min_stars=intent.get("stars"),
        family=bool(intent.get("child")),
        adults_only_ok=not bool(intent.get("child")),
        limit=6,
    )
    cards = [demo_hotel_to_card(hotel, idx + 1) for idx, hotel in enumerate(selected)]
    for card in cards:
        card["flags"] = _compute_card_flags(card, session.client_profile)
    session.last_cards = cards
    session.last_search_params = intent
    session.last_search_request_id = f"demo-{uuid.uuid4().hex[:8]}"
    session.history.append({"role": "user", "content": user_message})

    summary_lines = []
    if intent.get("country"):
        country_name = next(
            (h["country"] for h in DEMO_HOTELS if h["country_code"] == intent["country"]),
            "выбранному направлению",
        )
        summary_lines.append(f"Направление: {country_name}.")
    if intent.get("priceto"):
        summary_lines.append(f"Бюджет: до {intent['priceto']:,} ₽.")
    if intent.get("stars"):
        summary_lines.append(f"Звёзды: {intent['stars']}{'+' if intent.get('starsbetter') else ''}.")
    if intent.get("child"):
        summary_lines.append("Семейный сценарий: учитываю наличие детей.")
    if not cards:
        reply = (
            "Demo-каталог пока не нашёл идеальный матч. "
            "Попробуй уточнить: страна, бюджет, звёзды. "
            "Или подключи живой Tourvisor (TOURVISOR_AUTH_LOGIN/PASS в backend/.env)."
        )
        return {
            "reply": reply,
            "tour_cards": [],
            "tool_trace": ["demo:search"],
            "source": "local_demo_fallback",
        }

    cheapest = cards[0]
    best_family = next((c for c in cards if c.get("children")), cheapest)
    premium = max(cards, key=lambda c: c["price"])
    reply_lines = [
        "Работаю в DEMO-режиме (нет OPENAI_API_KEY) — отвечаю на простой парсилке, но карточки реальные.",
        *summary_lines,
        "",
        "Топ-3 для подборки клиенту:",
        f"1. {cheapest['hotel_name']} {cheapest['hotel_stars']}★ — самый бюджетный, {cheapest['price']:,} ₽ за {cheapest['nights']} ноч.",
    ]
    if best_family is not cheapest:
        reply_lines.append(
            f"2. {best_family['hotel_name']} {best_family['hotel_stars']}★ — оптимально для семьи, {best_family['price']:,} ₽."
        )
    if premium is not cheapest and premium is not best_family:
        reply_lines.append(
            f"3. {premium['hotel_name']} {premium['hotel_stars']}★ — апсейл/премиум, {premium['price']:,} ₽."
        )
    reply_lines.append("")
    reply_lines.append(
        "Это локальный демо-каталог (8 отелей). Для живого AI-диалога добавь OPENAI_API_KEY (OpenRouter / OpenAI), "
        "для живых туров — TOURVISOR_AUTH_LOGIN/PASS."
    )
    reply = "\n".join(reply_lines)
    session.history.append({"role": "assistant", "content": reply})

    return {
        "reply": reply,
        "tour_cards": cards,
        "tool_trace": ["demo:search"],
        "source": "local_demo_fallback",
    }


def _compact_history(history: List[Dict[str, Any]], keep_last_tool_results: int = 4) -> None:
    """Trim oversized tool results from older turns to keep prompt compact.

    Modifies history in place. Keeps:
    - System prompt (всегда первое сообщение)
    - First real user-message (он несёт исходный запрос клиента — критичен для cascade-regex
      проверки даже после многих function-call циклов; в mgp_v2 это эквивалент `_trim_history`
      который оставляет «pinned context»)
    - Most recent `keep_last_tool_results` tool messages intact
    - Earlier tool messages — заменяются маленьким placeholder, чтобы LLM видел структуру
      tool calls, но не платил токенами за payload.
    """
    tool_indices = [i for i, m in enumerate(history) if m.get("role") == "tool"]
    if len(tool_indices) <= keep_last_tool_results:
        return
    cut = tool_indices[:-keep_last_tool_results]
    for idx in cut:
        msg = history[idx]
        content = msg.get("content") or ""
        if isinstance(content, str) and len(content) > 200:
            msg["content"] = content[:160] + "...[truncated]"

    # Pin первого user-message: если по какой-то причине его контент урезан или пустой,
    # ничего не делаем (это safety-net на будущее, когда добавим обрезку user-messages).
    # Сейчас обрезаем только tool-messages, так что user-history остаётся полной.


async def _run_agent(session: CopilotSession, user_message: str) -> Dict[str, Any]:
    # Сбрасываем состояние ТЕКУЩЕГО хода до любого ветвления (demo или live):
    # это критично для бага с дублирующимися карточками.
    session.reset_turn_state()
    _update_collected_slots(session, user_message)
    session.client_profile = _extract_client_profile_hint(user_message, session.client_profile)
    session.allow_service_ids_this_turn = _wants_service_ids(user_message)

    client = _get_openai_client()
    if client is None:
        return _run_demo_agent(session, user_message)

    if not session.history:
        session.history.append({"role": "system", "content": _system_prompt()})

    _compact_history(session.history)
    if session.collected_slots:
        slot_lines = "\n".join(f"- {k}: {v}" for k, v in session.collected_slots.items())
        # Подсказка LLM в духе mgp_v2 OpenAIHandler._build_openai_messages, чтобы
        # модель не переспрашивала уже известные параметры на каждом ходе.
        session.history.append({
            "role": "system",
            "content": (
                "[СОБРАННЫЕ ПАРАМЕТРЫ КЛИЕНТА — НЕ переспрашивай]\n"
                + slot_lines
                + "\nЕсли клиент НЕ меняет параметр — используй сохранённое значение."
            ),
        })
    if session.client_profile:
        session.history.append({
            "role": "system",
            "content": (
                "[ПРОФИЛЬ КЛИЕНТА — учитывай при сравнениях, аргументах, флагах]\n"
                f"{session.client_profile}\n"
                "Это подсказка, не догма. Если агент явно отменил пункт — игнорируй его на этот ход."
            ),
        })
    session.history.append({"role": "user", "content": user_message})

    direct_hotel_response = await _try_direct_hotel_info_followup(session, user_message)
    if direct_hotel_response is not None:
        return direct_hotel_response

    tools = _openai_tools()
    final_text = ""
    last_call_summary: List[str] = []

    is_reasoning = _is_reasoning_model(DEFAULT_MODEL)
    reasoning_effort = os.getenv("OPENAI_REASONING_EFFORT", "minimal").lower()
    verbosity = os.getenv("OPENAI_VERBOSITY", "low").lower()
    max_completion_tokens = int(os.getenv("OPENAI_MAX_COMPLETION_TOKENS", "1500"))

    for step in range(MAX_AGENT_STEPS):
        completion_kwargs: Dict[str, Any] = {
            "model": DEFAULT_MODEL,
            "messages": session.history,
            "tools": tools,
            "tool_choice": "auto",
            "max_completion_tokens": max_completion_tokens,
        }
        if _model_supports_temperature(DEFAULT_MODEL):
            completion_kwargs["temperature"] = float(os.getenv("OPENAI_TEMPERATURE", "0.4"))
        extra_body: Dict[str, Any] = {}
        if is_reasoning:
            # gpt-5 / o-series accept reasoning_effort to short-circuit internal CoT.
            extra_body["reasoning_effort"] = reasoning_effort
            # gpt-5 supports verbosity to keep output concise.
            if "gpt-5" in DEFAULT_MODEL.lower():
                extra_body["verbosity"] = verbosity
        if extra_body:
            completion_kwargs["extra_body"] = extra_body
        step_started = time.time()
        try:
            completion = _llm_complete_with_backoff(client, completion_kwargs, session.id, step)
        except Exception as exc:
            logger.exception("OpenAI call failed at step %d", step)
            err_text = str(exc)
            retry_kwargs = dict(completion_kwargs)
            param_retry = False
            if "temperature" in err_text.lower() and "temperature" in retry_kwargs:
                logger.warning("Retrying without temperature override")
                retry_kwargs.pop("temperature", None)
                param_retry = True
            if "reasoning" in err_text.lower() and "extra_body" in retry_kwargs:
                logger.warning("Retrying without reasoning_effort/verbosity")
                retry_kwargs.pop("extra_body", None)
                param_retry = True
            if "max_completion_tokens" in err_text.lower() and "max_completion_tokens" in retry_kwargs:
                logger.warning("Falling back to max_tokens")
                retry_kwargs["max_tokens"] = retry_kwargs.pop("max_completion_tokens")
                param_retry = True
            if "max_tokens" in err_text.lower() and "max_tokens" in retry_kwargs and "max_completion_tokens" not in retry_kwargs:
                logger.warning("Removing max_tokens override")
                retry_kwargs.pop("max_tokens", None)
                param_retry = True
            if param_retry:
                try:
                    completion = _llm_complete_with_backoff(client, retry_kwargs, session.id, step)
                except Exception as exc2:
                    logger.exception("OpenAI retry failed")
                    session.turn_intent = "llm_error"
                    return {
                        "reply": _llm_user_error_message(exc2),
                        "tour_cards": [],
                        "tool_trace": last_call_summary,
                        "source": "llm_error",
                        "turn_intent": "llm_error",
                        "slots_collected": dict(session.collected_slots),
                        "cascade_missing": session.last_cascade_missing,
                        "cascade_nudge": session.last_cascade_nudge,
                    }
            else:
                session.turn_intent = "llm_error"
                return {
                    "reply": _llm_user_error_message(exc),
                    "tour_cards": [],
                    "tool_trace": last_call_summary,
                    "source": "llm_error",
                    "turn_intent": "llm_error",
                    "slots_collected": dict(session.collected_slots),
                    "cascade_missing": session.last_cascade_missing,
                    "cascade_nudge": session.last_cascade_nudge,
                }
        logger.info(
            "[%s] llm_step %d done in %.2fs effort=%s",
            session.id,
            step,
            time.time() - step_started,
            reasoning_effort if is_reasoning else "n/a",
        )

        choice = completion.choices[0]
        msg = choice.message

        if msg.tool_calls:
            session.history.append(
                {
                    "role": "assistant",
                    "content": msg.content or "",
                    "tool_calls": _serialize_tool_calls(msg),
                }
            )
            for tc in msg.tool_calls:
                fn_name = tc.function.name
                fn_args = tc.function.arguments or "{}"
                last_call_summary.append(fn_name)
                logger.info("[%s] tool_call %s args=%s", session.id, fn_name, fn_args[:200])
                tool_result = await _run_tool(fn_name, fn_args, session)
                session.history.append(
                    {
                        "role": "tool",
                        "tool_call_id": tc.id,
                        "name": fn_name,
                        "content": tool_result,
                    }
                )
            continue

        final_text = _sanitize_agent_reply(
            msg.content or "",
            allow_service_ids=session.allow_service_ids_this_turn,
        )
        session.history.append({"role": "assistant", "content": final_text})
        break
    else:
        final_text = (
            "Не уложился в шаги вызова инструментов. "
            "Проверьте логи backend и попробуйте переформулировать запрос."
        )
        session.history.append({"role": "assistant", "content": final_text})

    return _build_agent_response(session, final_text, last_call_summary)


def _build_agent_response(
    session: CopilotSession,
    final_text: str,
    tool_trace: List[str],
) -> Dict[str, Any]:
    """Формируем ответ /api/copilot/chat.

    Главное правило: tour_cards берём из session.turn_pending_cards (карточки,
    построенные ИМЕННО в этом ходе), а не из session.last_cards (память сессии).
    Это исправляет дубликат карточек после follow-up вопросов про отель/WhatsApp.
    """
    cards = list(session.turn_pending_cards)
    memory_cards = cards or list(session.last_cards)
    final_text = _replace_placeholder_hotels(final_text, memory_cards)
    final_text = _sanitize_agent_reply(
        final_text,
        allow_service_ids=session.allow_service_ids_this_turn,
    )
    intent = session.turn_intent

    if cards:
        source = "tourvisor_api"
    elif intent == "cascade_block":
        source = "cascade_block"
    elif intent == "hotel_info":
        source = "hotel_info"
    elif intent in ("hot_tours", "new_search"):
        source = "tourvisor_api"
    else:
        source = "agent"

    return {
        "reply": final_text or "(пустой ответ)",
        "tour_cards": cards,
        "tool_trace": tool_trace,
        "source": source,
        "turn_intent": intent,
        "slots_collected": dict(session.collected_slots),
        "cascade_missing": session.last_cascade_missing,
        "cascade_nudge": session.last_cascade_nudge,
    }


# ────────────────────────────────────────────────────────────────────
# Endpoints
# ────────────────────────────────────────────────────────────────────


@app.post("/api/copilot/chat")
def copilot_chat():
    data = request.get_json(silent=True) or {}
    message = (data.get("message") or "").strip()
    if not message:
        return jsonify({"error": "message_required"}), 400

    session = _get_session(data.get("conversation_id"))
    started = time.time()
    payload = asyncio.run(_run_agent(session, message))
    elapsed = time.time() - started
    logger.info(
        "[%s] chat done in %.2fs cards=%d tools=%s",
        session.id,
        elapsed,
        len(payload.get("tour_cards", [])),
        payload.get("tool_trace"),
    )
    payload["conversation_id"] = session.id
    return jsonify(payload)


@app.post("/api/v1/chat")
def chat_v1():
    data = request.get_json(silent=True) or {}
    message = (data.get("message") or "").strip()
    if not message:
        return jsonify({"error": "message_required"}), 400
    session = _get_session(data.get("conversation_id"))
    payload = asyncio.run(_run_agent(session, message))
    return jsonify(
        {
            "reply": payload["reply"],
            "tour_cards": payload.get("tour_cards", []),
            "conversation_id": session.id,
        }
    )


@app.get("/api/hotel/<int:hotel_code>")
def hotel_info(hotel_code: int):
    if not _has_tourvisor_credentials():
        for hotel in DEMO_HOTELS:
            if hotel["hotel_code"] == hotel_code:
                return jsonify(demo_hotel_to_info(hotel))
        return jsonify({"error": "demo_hotel_not_found"}), 404
    try:

        async def _runner():
            client = TourVisorClient()
            try:
                return await client.get_hotel_info(
                    hotel_code=hotel_code,
                    big_images=True,
                    remove_tags=True,
                    include_reviews=True,
                )
            finally:
                await client.close()

        hotel = asyncio.run(_runner())
    except TourVisorError as exc:
        return jsonify({"error": "tourvisor_error", "message": str(exc)}), 502
    return jsonify(_hotel_info_to_frontend(hotel))


@app.get("/api/tour/<tour_id>/flights")
def tour_flights(tour_id: str):
    if tour_id.startswith("demo-") or not _has_tourvisor_credentials():
        for session in SESSIONS.values():
            for card in session.last_cards:
                if card.get("tour_id") == tour_id:
                    return jsonify(demo_flight_option(card))
        # default fallback for any demo tour
        if DEMO_HOTELS:
            base_card = demo_hotel_to_card(DEMO_HOTELS[0], 1)
            return jsonify(demo_flight_option(base_card))
        return jsonify({"flights": []})
    try:

        async def _runner():
            client = TourVisorClient()
            try:
                return await client.get_tour_details(tour_id=tour_id)
            finally:
                await client.close()

        details = asyncio.run(_runner())
    except TourIdExpiredError as exc:
        return jsonify({"error": "expired", "message": str(exc)}), 410
    except TourVisorError as exc:
        return jsonify({"error": "tourvisor_error", "message": str(exc)}), 502
    return jsonify(_flights_to_frontend(details))


@app.post("/api/tour/<tour_id>/actualize")
def tour_actualize(tour_id: str):
    """Lightweight actualize endpoint, дергается из HotelDetailModal по кнопке.

    Не использует LLM — просто проксирует actualize.php (или возвращает demo-стаб),
    чтобы UI смог локально показать «актуальную цену» в чате (см. AiCopilotPanel).
    Лимиты сессии (`tools_used_this_turn`) намеренно не применяются — это ручное
    действие агента, а не автоматический LLM-вызов.
    """
    if tour_id.startswith("demo-") or not _has_tourvisor_credentials():
        for session in SESSIONS.values():
            for card in session.last_cards:
                if card.get("tour_id") == tour_id:
                    actual = int(card.get("price") or 0)
                    return jsonify({
                        "tourid": tour_id,
                        "actual_price": actual,
                        "old_price": actual,
                        "delta": 0,
                        "currency": card.get("currency") or "RUB",
                        "operator_link": None,
                        "places_status": None,
                        "mode": "demo",
                    })
        return jsonify({
            "tourid": tour_id,
            "mode": "demo",
            "message": "Tour not found in active sessions",
        }), 404

    try:

        async def _runner():
            client = TourVisorClient()
            try:
                return await client.actualize_tour(tour_id=tour_id, request_mode=2)
            finally:
                await client.close()

        tour = asyncio.run(_runner())
    except TourIdExpiredError as exc:
        return jsonify({"error": "expired", "message": str(exc)}), 410
    except TourVisorError as exc:
        return jsonify({"error": "tourvisor_error", "message": str(exc)}), 502

    actual_price = _coerce_int(tour.get("price"))
    old_price = _coerce_int(tour.get("priceold")) or _coerce_int(tour.get("price_old"))
    delta = None
    if actual_price is not None and old_price:
        delta = actual_price - old_price

    return jsonify({
        "tourid": tour_id,
        "actual_price": actual_price,
        "old_price": old_price,
        "delta": delta,
        "currency": _coerce_str(tour.get("currency")) or "RUB",
        "operator_link": _coerce_str(tour.get("operatorlink")) or None,
        "places_status": _coerce_str(
            tour.get("places") or tour.get("placesleft") or tour.get("placesstatus")
        ) or None,
        "hotel_name": _coerce_str(tour.get("hotelname")),
    })


# ────────────────────────────────────────────────────────────────────
# Shared collections (для отправки клиенту)
# ────────────────────────────────────────────────────────────────────
#
# Идея: турагент в чате просит «собери подборку из 1, 2 и 5» или нажимает
# в UI «Поделиться подборкой» — фронт постит карточки на /api/collection,
# мы отдаём публичный URL вида /share/<id>. Клиент открывает ссылку и
# видит красивую HTML-страницу: фото отеля, ключевые факты, цены, питание,
# рейсы (если зафиксированы). Никаких ссылок на Tourvisor, никаких ID/
# requestid в HTML — это публичная страница, она для клиента.
#
# Хранилище — in-memory dict, как SESSIONS. Этого достаточно для демо;
# на продакшне сюда нужно подменить на Redis/Postgres.

COLLECTIONS: Dict[str, Dict[str, Any]] = {}
COLLECTION_TTL_SECONDS = 60 * 60 * 24 * 30  # 30 дней


def _purge_expired_collections() -> None:
    now = time.time()
    expired = [
        cid
        for cid, payload in COLLECTIONS.items()
        if now - float(payload.get("created_ts", now)) > COLLECTION_TTL_SECONDS
    ]
    for cid in expired:
        COLLECTIONS.pop(cid, None)


def _share_card_payload(card: Dict[str, Any]) -> Dict[str, Any]:
    """Очищаем карточку перед сохранением: убираем служебные поля,
    оставляем только то, что нужно показать клиенту на share-странице.
    """
    selected_flight = card.get("selected_flight") or None
    flight_summary = card.get("flight_summary") or None

    # Из selected_flight для клиента вытаскиваем только человеко-читаемое.
    flight_view: Optional[Dict[str, Any]] = None
    if isinstance(selected_flight, dict):
        fwd_list = selected_flight.get("forward") or []
        bwd_list = selected_flight.get("backward") or []
        first_fwd = fwd_list[0] if fwd_list else {}
        first_bwd = bwd_list[0] if bwd_list else {}
        flight_view = {
            "airline": first_fwd.get("airline") or first_bwd.get("airline") or "",
            "forward": {
                "from": first_fwd.get("departure_airport") or "",
                "from_code": first_fwd.get("departure_airport_code") or "",
                "to": first_fwd.get("arrival_airport") or "",
                "to_code": first_fwd.get("arrival_airport_code") or "",
                "depart_time": first_fwd.get("departure_time") or "",
                "arrive_time": first_fwd.get("arrival_time") or "",
                "depart_date": first_fwd.get("departure_date") or "",
            },
            "backward": {
                "from": first_bwd.get("departure_airport") or "",
                "from_code": first_bwd.get("departure_airport_code") or "",
                "to": first_bwd.get("arrival_airport") or "",
                "to_code": first_bwd.get("arrival_airport_code") or "",
                "depart_time": first_bwd.get("departure_time") or "",
                "arrive_time": first_bwd.get("arrival_time") or "",
                "depart_date": first_bwd.get("departure_date") or "",
            },
            "baggage": first_fwd.get("baggage") or first_bwd.get("baggage") or "",
        }

    return {
        "hotel_name": card.get("hotel_name") or "",
        "hotel_stars": int(card.get("hotel_stars") or 0),
        "hotel_rating": str(card.get("hotel_rating") or ""),
        "country": card.get("country") or "",
        "resort": card.get("resort") or "",
        "price": int(card.get("price") or 0),
        "currency": card.get("currency") or "RUB",
        "nights": int(card.get("nights") or 0),
        "date_from": card.get("date_from") or "",
        "date_to": card.get("date_to") or "",
        "meal_description": card.get("meal_description") or "",
        "departure_city": card.get("departure_city") or "",
        "image_url": card.get("image_url") or "",
        "sea_distance": card.get("sea_distance") or "",
        "hotel_code": int(card.get("hotel_code") or 0),
        "flight_summary": flight_summary,
        "flight": flight_view,
    }


@app.post("/api/collection")
def create_collection():
    """Создать share-подборку. Принимает {cards: [TourCard...]} или
    {cards: [...], conversation_id: "..."} (тогда подтягиваем доп.инфо
    из сессии: например, client_profile для подзаголовка).
    """
    data = request.get_json(silent=True) or {}
    raw_cards = data.get("cards") or []
    if not isinstance(raw_cards, list) or not raw_cards:
        return jsonify({"error": "cards_required"}), 400
    if len(raw_cards) > 12:
        return jsonify({"error": "too_many_cards", "limit": 12}), 400

    cards_payload = [_share_card_payload(c) for c in raw_cards if isinstance(c, dict)]
    if not cards_payload:
        return jsonify({"error": "empty_cards"}), 400

    profile = None
    cid = data.get("conversation_id")
    if cid and cid in SESSIONS:
        profile = SESSIONS[cid].client_profile

    _purge_expired_collections()

    collection_id = uuid.uuid4().hex[:12]
    COLLECTIONS[collection_id] = {
        "id": collection_id,
        "created_ts": time.time(),
        "cards": cards_payload,
        "title": data.get("title") or "Подборка туров",
        "agent_note": data.get("agent_note") or "",
        "client_profile": profile,
    }

    base_url = request.host_url.rstrip("/")
    return jsonify({
        "collection_id": collection_id,
        "share_url": f"{base_url}/share/{collection_id}",
        "email_url": f"{base_url}/share/{collection_id}/email",
        "json_url": f"{base_url}/api/collection/{collection_id}",
        "expires_at": int(time.time()) + COLLECTION_TTL_SECONDS,
    })


@app.get("/api/collection/<collection_id>")
def get_collection(collection_id: str):
    payload = COLLECTIONS.get(collection_id)
    if not payload:
        return jsonify({"error": "not_found"}), 404
    return jsonify(payload)


def _format_price_ru(value: int, currency: str = "RUB") -> str:
    if not value:
        return "—"
    formatted = f"{value:,}".replace(",", " ")
    if currency == "RUB":
        return f"{formatted} ₽"
    return f"{formatted} {currency}"


def _render_share_card(card: Dict[str, Any]) -> str:
    """HTML карточки для публичной страницы. Без ссылок на Tourvisor."""
    img = card.get("image_url") or ""
    if img.startswith("//"):
        img = "https:" + img
    img_block = (
        f'<div class="card-photo" style="background-image:url(\'{html_escape(img)}\')"></div>'
        if img
        else '<div class="card-photo card-photo-empty">🏨</div>'
    )

    stars = "★" * max(1, min(5, int(card.get("hotel_stars") or 0)))
    rating = html_escape(str(card.get("hotel_rating") or ""))
    rating_html = (
        f'<span class="card-rating">★ {rating}</span>' if rating and rating != "0" else ""
    )

    flight = card.get("flight") or {}
    flight_block = ""
    if flight:
        airline = html_escape(flight.get("airline") or "")
        fwd = flight.get("forward") or {}
        bwd = flight.get("backward") or {}
        baggage = html_escape(flight.get("baggage") or "уточняется у оператора")
        flight_block = f"""
        <div class="flight-block">
          <div class="flight-title">Зафиксированный перелёт</div>
          <div class="flight-row">
            <span class="airline">{airline}</span>
            <span class="route">
              {html_escape(fwd.get('from_code') or fwd.get('from') or '')} {html_escape(fwd.get('depart_time') or '')}
              → {html_escape(fwd.get('to_code') or fwd.get('to') or '')} {html_escape(fwd.get('arrive_time') or '')}
            </span>
          </div>
          <div class="flight-row">
            <span class="airline">обратно</span>
            <span class="route">
              {html_escape(bwd.get('from_code') or bwd.get('from') or '')} {html_escape(bwd.get('depart_time') or '')}
              → {html_escape(bwd.get('to_code') or bwd.get('to') or '')} {html_escape(bwd.get('arrive_time') or '')}
            </span>
          </div>
          <div class="flight-baggage">Багаж: {baggage}</div>
        </div>
        """

    meta_parts: List[str] = []
    if card.get("date_from"):
        meta_parts.append(html_escape(card["date_from"]))
    if card.get("nights"):
        meta_parts.append(f"{card['nights']} ночей")
    if card.get("meal_description"):
        meta_parts.append(html_escape(card["meal_description"]))
    if card.get("departure_city"):
        meta_parts.append(f"из {html_escape(card['departure_city'])}")

    return f"""
    <article class="card">
      {img_block}
      <div class="card-body">
        <header class="card-head">
          <div>
            <h3 class="card-title">{html_escape(card.get('hotel_name') or '')}</h3>
            <div class="card-loc">
              <span>{html_escape(card.get('country') or '')}</span>
              <span>·</span>
              <span>{html_escape(card.get('resort') or '')}</span>
            </div>
          </div>
          <div class="card-meta-right">
            <div class="card-stars">{stars}</div>
            {rating_html}
          </div>
        </header>
        <div class="card-meta">{ ' · '.join(meta_parts) }</div>
        {flight_block}
        <div class="card-foot">
          <div class="card-price">
            <span class="price-label">от</span>
            <span class="price-value">{_format_price_ru(card.get('price') or 0, card.get('currency') or 'RUB')}</span>
            <span class="price-suffix">за тур</span>
          </div>
        </div>
      </div>
    </article>
    """


_SHARE_PAGE_CSS = """
:root {
  --brand: #009af3;
  --brand-deep: #1b68d2;
  --ink: #0f172a;
  --muted: #64748b;
  --bg: #f6f9fc;
  --card: #ffffff;
  --border: #e6ecf2;
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  font-family: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif;
  background: var(--bg);
  color: var(--ink);
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}
.wrapper { max-width: 980px; margin: 0 auto; padding: 32px 20px 64px; }
.hero {
  background: linear-gradient(135deg, var(--brand), var(--brand-deep));
  color: white;
  border-radius: 24px;
  padding: 36px 32px;
  box-shadow: 0 18px 40px rgba(0, 154, 243, 0.25);
  margin-bottom: 28px;
}
.hero h1 { margin: 0 0 8px 0; font-size: 28px; font-weight: 800; letter-spacing: -0.02em; }
.hero p { margin: 0; opacity: 0.92; font-size: 15px; max-width: 640px; }
.summary { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 18px; }
.summary span {
  background: rgba(255,255,255,0.18);
  border-radius: 999px;
  padding: 6px 12px;
  font-size: 13px;
  font-weight: 600;
}
.cards { display: grid; gap: 18px; }
.card {
  background: var(--card);
  border-radius: 22px;
  border: 1px solid var(--border);
  overflow: hidden;
  display: grid;
  grid-template-columns: 280px 1fr;
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.05);
  transition: transform 0.2s, box-shadow 0.2s;
}
.card:hover { transform: translateY(-2px); box-shadow: 0 12px 28px rgba(15, 23, 42, 0.08); }
@media (max-width: 720px) { .card { grid-template-columns: 1fr; } }
.card-photo {
  background-size: cover;
  background-position: center;
  background-color: #cbd5e1;
  min-height: 220px;
}
.card-photo-empty {
  display: flex; align-items: center; justify-content: center;
  font-size: 56px; background: linear-gradient(135deg, #e0f2fe, #f0f9ff);
}
.card-body { padding: 22px 24px; display: flex; flex-direction: column; gap: 10px; }
.card-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.card-title { margin: 0; font-size: 19px; font-weight: 800; letter-spacing: -0.01em; }
.card-loc { font-size: 13px; color: var(--muted); display: flex; gap: 6px; flex-wrap: wrap; margin-top: 2px; }
.card-meta-right { text-align: right; min-width: 80px; }
.card-stars { color: #f59e0b; font-size: 15px; letter-spacing: 1px; }
.card-rating { display: inline-block; margin-top: 4px; font-size: 13px; font-weight: 700; color: var(--brand-deep); }
.card-meta {
  display: inline-block;
  font-size: 13px;
  color: var(--muted);
  background: #f1f5f9;
  padding: 8px 12px;
  border-radius: 12px;
  width: fit-content;
}
.flight-block {
  background: #f0f9ff;
  border: 1px solid #bae6fd;
  border-radius: 14px;
  padding: 12px 14px;
  font-size: 13px;
  color: #0c4a6e;
}
.flight-title { font-weight: 700; margin-bottom: 6px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; }
.flight-row { display: flex; gap: 12px; padding: 2px 0; }
.flight-row .airline { font-weight: 600; min-width: 90px; }
.flight-row .route { color: #0369a1; }
.flight-baggage { margin-top: 6px; font-size: 12px; color: #075985; opacity: 0.85; }
.card-foot { display: flex; justify-content: flex-end; align-items: center; gap: 12px; margin-top: 4px; }
.card-price { display: flex; align-items: baseline; gap: 6px; }
.price-label { color: var(--muted); font-size: 12px; }
.price-value { font-size: 24px; font-weight: 800; color: var(--ink); letter-spacing: -0.02em; }
.price-suffix { color: var(--muted); font-size: 12px; }
.footer {
  margin-top: 36px;
  text-align: center;
  font-size: 12px;
  color: var(--muted);
  padding: 16px;
}
"""


@app.get("/share/<collection_id>")
def share_collection(collection_id: str):
    """Публичная HTML-страница подборки. Открывается клиентом по ссылке.
    Намеренно не использует ничего, кроме встроенного HTML — никаких
    внешних JS, никаких ссылок на Tourvisor."""
    payload = COLLECTIONS.get(collection_id)
    if not payload:
        return Response("Подборка не найдена или истёк срок ссылки.", status=404, mimetype="text/html")

    cards = payload.get("cards") or []
    title = payload.get("title") or "Подборка туров"
    profile = payload.get("client_profile") or ""
    countries = sorted({c.get("country") for c in cards if c.get("country")})
    min_price = min((c.get("price") or 0) for c in cards) if cards else 0
    max_price = max((c.get("price") or 0) for c in cards) if cards else 0

    summary_chips: List[str] = [f"{len(cards)} вариантов"]
    if countries:
        summary_chips.append(" · ".join(countries))
    if min_price and max_price and min_price != max_price:
        summary_chips.append(f"от {_format_price_ru(min_price)} до {_format_price_ru(max_price)}")
    elif min_price:
        summary_chips.append(f"от {_format_price_ru(min_price)}")

    cards_html = "\n".join(_render_share_card(c) for c in cards)
    summary_html = "".join(f"<span>{html_escape(s)}</span>" for s in summary_chips)
    profile_html = (
        f"<p>{html_escape(profile)}</p>" if profile else "<p>Подобрали для вас несколько вариантов — посмотрите и выберите тот, что нравится больше.</p>"
    )

    html = f"""<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{html_escape(title)}</title>
  <style>{_SHARE_PAGE_CSS}</style>
</head>
<body>
  <div class="wrapper">
    <section class="hero">
      <h1>{html_escape(title)}</h1>
      {profile_html}
      <div class="summary">{summary_html}</div>
    </section>
    <section class="cards">
      {cards_html}
    </section>
    <div class="footer">Подборка действует 30 дней. Свяжитесь с менеджером, чтобы забронировать.</div>
  </div>
</body>
</html>"""
    return Response(html, mimetype="text/html; charset=utf-8")


def _render_email_card(card: Dict[str, Any]) -> str:
    """E-mail-friendly HTML: только table-вёрстка, inline-стили, без css-grid."""
    img = card.get("image_url") or ""
    if img.startswith("//"):
        img = "https:" + img
    img_html = (
        f'<img src="{html_escape(img)}" width="220" alt="" style="display:block;border-radius:8px;border:0;outline:none;text-decoration:none;width:100%;max-width:220px;height:auto;">'
        if img
        else '<div style="width:220px;height:130px;background:#dbeafe;border-radius:8px;text-align:center;line-height:130px;font-size:42px;">🏨</div>'
    )
    stars = "★" * max(1, min(5, int(card.get("hotel_stars") or 0)))
    meta = " · ".join(
        filter(None, [
            card.get("date_from"),
            (f"{card['nights']} ночей" if card.get("nights") else ""),
            card.get("meal_description"),
        ])
    )
    return f"""
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:16px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
      <tr>
        <td width="240" valign="top" style="padding:14px;">{img_html}</td>
        <td valign="top" style="padding:14px 18px 14px 0;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
          <div style="font-size:11px;color:#64748b;margin-bottom:4px;">
            {html_escape(card.get('country') or '')} · {html_escape(card.get('resort') or '')}
          </div>
          <div style="font-size:17px;font-weight:700;line-height:1.3;margin-bottom:4px;">
            {html_escape(card.get('hotel_name') or '')}
          </div>
          <div style="color:#f59e0b;font-size:13px;margin-bottom:8px;">{stars}</div>
          <div style="font-size:13px;color:#475569;margin-bottom:10px;">{html_escape(meta)}</div>
          <div style="font-size:20px;font-weight:800;color:#0f172a;">
            от {_format_price_ru(card.get('price') or 0, card.get('currency') or 'RUB')}
          </div>
        </td>
      </tr>
    </table>
    """


@app.get("/share/<collection_id>/email")
def share_email(collection_id: str):
    """E-mail-вариант подборки. Inline-стили, table-вёрстка, готов к копи-пасту в письмо."""
    payload = COLLECTIONS.get(collection_id)
    if not payload:
        return Response("Подборка не найдена.", status=404, mimetype="text/html")

    cards = payload.get("cards") or []
    title = payload.get("title") or "Подборка туров"
    profile = payload.get("client_profile") or "Подобрали для вас несколько вариантов."

    cards_html = "\n".join(_render_email_card(c) for c in cards)
    base_url = request.host_url.rstrip("/")
    public_url = f"{base_url}/share/{collection_id}"

    email = f"""<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <title>{html_escape(title)}</title>
</head>
<body style="margin:0;padding:24px;background:#f6f9fc;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:640px;margin:0 auto;">
    <tr><td>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:linear-gradient(135deg,#009af3,#1b68d2);color:#ffffff;border-radius:14px;padding:24px;margin-bottom:18px;">
        <tr><td style="font-size:20px;font-weight:800;">{html_escape(title)}</td></tr>
        <tr><td style="font-size:14px;opacity:0.92;padding-top:6px;">{html_escape(profile)}</td></tr>
        <tr><td style="font-size:12px;padding-top:14px;">
          <a href="{html_escape(public_url)}" style="color:#ffffff;text-decoration:underline;">Посмотреть онлайн</a>
        </td></tr>
      </table>
      {cards_html}
      <p style="font-size:11px;color:#64748b;text-align:center;margin-top:16px;">
        Чтобы забронировать или задать вопрос — ответьте на это письмо.
      </p>
    </td></tr>
  </table>
</body>
</html>"""
    return Response(email, mimetype="text/html; charset=utf-8")


@app.post("/api/reset")
def reset():
    data = request.get_json(silent=True) or {}
    cid = data.get("conversation_id") or data.get("session_id")
    if cid:
        SESSIONS.pop(cid, None)
    return jsonify({"ok": True})


@app.get("/api/health")
def health():
    has_llm = bool(os.getenv("OPENAI_API_KEY"))
    has_tv = _has_tourvisor_credentials()
    if has_llm and has_tv:
        mode = "live"
    elif has_llm:
        mode = "llm_only"
    elif has_tv:
        mode = "tv_only"
    else:
        mode = "demo"
    return jsonify(
        {
            "status": "ok",
            "date": date.today().isoformat(),
            "mode": mode,
            "llm_configured": has_llm,
            "tourvisor_configured": has_tv,
            "model": DEFAULT_MODEL,
            "sessions": len(SESSIONS),
        }
    )


@app.get("/api/status")
def status_alias():
    """Backward-compatible alias for /api/health used by legacy frontend code."""
    return health()


@app.get("/api/tour/<tour_id>/actualize")
def tour_actualize_legacy(tour_id: str):
    """Legacy GET actualize used by `useFavoritesRefresh` on the existing
    favourites screen. Returns the simpler `{available, price, operator}` shape
    so the existing UI continues to work unchanged. The richer POST endpoint
    above keeps emitting the new agent-mode payload (delta, operator_link, …).
    """
    if tour_id.startswith("demo-") or not _has_tourvisor_credentials():
        for session in SESSIONS.values():
            for card in session.last_cards:
                if card.get("tour_id") == tour_id:
                    return jsonify({
                        "available": True,
                        "price": int(card.get("price") or 0),
                        "operator": card.get("operator") or "",
                        "currency": card.get("currency") or "RUB",
                        "mode": "demo",
                    })
        return jsonify({"available": False, "error": "demo_not_found"}), 404

    try:

        async def _runner():
            client = TourVisorClient()
            try:
                return await client.actualize_tour(tour_id=tour_id, request_mode=2)
            finally:
                await client.close()

        tour = asyncio.run(_runner())
    except TourIdExpiredError as exc:
        return jsonify({"available": False, "error": "expired", "message": str(exc)}), 410
    except TourVisorError as exc:
        return jsonify({"available": False, "error": "tourvisor_error", "message": str(exc)}), 502

    actual_price = _coerce_int(tour.get("price"))
    return jsonify({
        "available": bool(actual_price),
        "price": actual_price,
        "operator": _coerce_str(tour.get("operatorname")) or None,
        "currency": _coerce_str(tour.get("currency")) or "RUB",
        "hotel_name": _coerce_str(tour.get("hotelname")),
    })


if __name__ == "__main__":
    port = int(os.getenv("PORT", os.getenv("FLASK_PORT", "8090")))
    app.run(host="0.0.0.0", port=port, debug=os.getenv("FLASK_DEBUG", "1") == "1")
