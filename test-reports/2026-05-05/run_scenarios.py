"""
Прогон 13 пользовательских сценариев Навылет AI через реальный backend.
Собирает localStorage-seed (формат navylet_sessions) + Markdown-транскрипты.

Запуск:
    cd test-reports/2026-05-05 && python3 run_scenarios.py [номера через запятую]

Результаты:
    sessions.json           — localStorage seed для UI (ключ navylet_sessions)
    scenarios/sc-NN.md      — читаемый транскрипт каждого сценария
    REPORT.md               — общий отчёт
"""

from __future__ import annotations

import base64
import io
import json
import os
import sys
import time
import uuid
import urllib.error
import urllib.request
from datetime import datetime
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple

API = os.environ.get("NAVYLET_API", "http://localhost:8090")
HERE = Path(__file__).parent
SCEN_DIR = HERE / "scenarios"
SCEN_DIR.mkdir(parents=True, exist_ok=True)


# ---------- HTTP helpers ----------

def _post(path: str, payload: Dict[str, Any], timeout: int = 240) -> Dict[str, Any]:
    body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        f"{API}{path}",
        data=body,
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))


def _get(path: str, timeout: int = 30) -> Tuple[int, str]:
    req = urllib.request.Request(f"{API}{path}", method="GET")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", errors="replace")


def call_chat(cid: str, message: str, images: Optional[List[str]] = None) -> Dict[str, Any]:
    payload: Dict[str, Any] = {"conversation_id": cid, "message": message}
    if images:
        payload["images"] = images
    return _post("/api/copilot/chat", payload)


def create_collection(title: str, cards: List[Dict[str, Any]], note: str = "",
                      conversation_id: Optional[str] = None) -> Dict[str, Any]:
    """POST /api/collection ожидает поле `cards` (см. backend/app.py:create_collection)."""
    payload: Dict[str, Any] = {"title": title, "cards": cards, "agent_note": note}
    if conversation_id:
        payload["conversation_id"] = conversation_id
    return _post("/api/collection", payload)


# ---------- Vision helpers ----------

def make_screenshot_png(text_lines: List[str]) -> str:
    """
    Генерирует PNG со скриншотом-имитацией WhatsApp-переписки.
    Возвращает data:URL с base64-телом.
    """
    from PIL import Image, ImageDraw, ImageFont

    W, H = 720, 880
    img = Image.new("RGB", (W, H), color=(229, 221, 213))  # WhatsApp beige
    d = ImageDraw.Draw(img)

    try:
        font_h = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 28)
        font_b = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 22)
    except Exception:
        font_h = ImageFont.load_default()
        font_b = ImageFont.load_default()

    d.rectangle([(0, 0), (W, 70)], fill=(7, 94, 84))
    d.text((20, 20), "Клиент Иванов · в сети", fill=(255, 255, 255), font=font_h)

    y = 100
    for i, line in enumerate(text_lines):
        is_left = i % 2 == 0
        bubble_color = (255, 255, 255) if is_left else (220, 248, 198)
        x0 = 20 if is_left else 200
        x1 = 520 if is_left else 700
        h = 70
        d.rounded_rectangle([(x0, y), (x1, y + h)], radius=14, fill=bubble_color)
        d.text((x0 + 16, y + 18), line, fill=(0, 0, 0), font=font_b)
        y += h + 18

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode("ascii")
    return f"data:image/png;base64,{b64}"


# ---------- Session/transcript builders ----------

def now_ms() -> int:
    return int(time.time() * 1000)


def msg_id() -> str:
    return f"m_{uuid.uuid4().hex[:8]}"


def session_id() -> str:
    return uuid.uuid4().__str__()


def short_title(text: str, n: int = 38) -> str:
    text = text.strip()
    return text if len(text) <= n else text[: n - 1] + "…"


def card_label(c: Dict[str, Any]) -> str:
    name = c.get("hotel_name") or "?"
    stars = c.get("hotel_stars") or "?"
    country = c.get("country") or ""
    resort = c.get("resort") or ""
    price = c.get("price") or 0
    return f"{name} ({stars}★, {country}{', '+resort if resort else ''}) — {price:,} ₽".replace(",", " ")


def flag_summary(c: Dict[str, Any]) -> str:
    flags = c.get("flags") or []
    if not flags:
        return "—"
    return ", ".join(f"{f.get('label')}({f.get('severity')})" for f in flags[:6])


# ---------- Scenario runner ----------

class Scenario:
    def __init__(self, num: int, title: str, kind: str = "chat") -> None:
        self.num = num
        self.title = title
        self.kind = kind
        self.cid = session_id()
        self.messages: List[Dict[str, Any]] = []
        self.transcript_lines: List[str] = []
        self.notes: List[str] = []
        self.last_cards: List[Dict[str, Any]] = []
        self.client_profile: Optional[str] = None

    # --------- core: send a message ---------
    def send(self, user_text: str, images: Optional[List[str]] = None,
             expect: Optional[str] = None, image_label: Optional[str] = None) -> Dict[str, Any]:
        # 1) user message
        user_msg = {
            "id": msg_id(),
            "role": "user",
            "content": user_text,
            "timestamp": now_ms(),
        }
        self.messages.append(user_msg)

        # 2) backend call
        t0 = time.time()
        try:
            resp = call_chat(self.cid, user_text, images=images)
        except Exception as e:
            err_msg = {
                "id": msg_id(),
                "role": "assistant",
                "content": f"[ERROR] {e}",
                "timestamp": now_ms(),
            }
            self.messages.append(err_msg)
            self._append_md(user_text, image_label, "[ERROR]", [], err=str(e))
            return {}
        elapsed = time.time() - t0

        reply = resp.get("reply") or ""
        cards = resp.get("tour_cards") or []
        if cards:
            self.last_cards = cards
        prof = resp.get("client_profile")
        if prof:
            self.client_profile = prof

        # 3) assistant message — same shape as ChatMessage in TS
        asst_msg: Dict[str, Any] = {
            "id": msg_id(),
            "role": "assistant",
            "content": reply,
            "timestamp": now_ms(),
        }
        if cards:
            asst_msg["tour_cards"] = cards
        if resp.get("cascade_missing"):
            asst_msg["cascade_missing"] = resp["cascade_missing"]
        if resp.get("slots"):
            asst_msg["slots"] = resp["slots"]
        if resp.get("cascade_phase"):
            asst_msg["cascade_phase"] = resp["cascade_phase"]
        self.messages.append(asst_msg)

        # 4) Markdown transcript
        self._append_md(
            user_text, image_label, reply, cards,
            elapsed=elapsed,
            tool_trace=resp.get("tool_trace"),
            cascade_missing=resp.get("cascade_missing"),
            client_profile=resp.get("client_profile"),
            expect=expect,
        )
        return resp

    def append_local(self, user_text: str, asst_text: str, cards: Optional[List[Dict[str, Any]]] = None,
                     section: Optional[str] = None) -> None:
        """Имитация UI-генерации без обращения к LLM (fix flight, build collection final)."""
        self.messages.append({"id": msg_id(), "role": "user", "content": user_text, "timestamp": now_ms()})
        am: Dict[str, Any] = {"id": msg_id(), "role": "assistant", "content": asst_text, "timestamp": now_ms()}
        if cards:
            am["tour_cards"] = cards
            self.last_cards = cards
        self.messages.append(am)

        block = ["", f"### [UI-инъекция] {section or 'локальное действие'}"]
        block.append(f"**Пользователь:** {user_text}")
        block.append("")
        block.append(f"**Ассистент:** {asst_text}")
        if cards:
            block.append("")
            block.append("Карточки в чате:")
            for i, c in enumerate(cards, 1):
                block.append(f"  {i}. {card_label(c)}")
        self.transcript_lines.extend(block)

    def note(self, line: str) -> None:
        self.notes.append(line)

    def _append_md(self, user_text: str, image_label: Optional[str], reply: str,
                   cards: List[Dict[str, Any]], elapsed: float = 0.0,
                   tool_trace: Optional[List[str]] = None,
                   cascade_missing: Optional[str] = None,
                   client_profile: Optional[str] = None,
                   expect: Optional[str] = None,
                   err: Optional[str] = None) -> None:
        L = self.transcript_lines
        L.append("")
        L.append("---")
        head = "**Пользователь:**"
        if image_label:
            head += f" `[image:{image_label}]`"
        L.append(head)
        L.append("")
        L.append(user_text or "_(пусто)_")
        L.append("")
        L.append(f"**Ассистент:** _({elapsed:.1f}s)_" + (" 🚨" if err else ""))
        L.append("")
        L.append(reply or "_(пустой ответ)_")
        meta_bits: List[str] = []
        if tool_trace:
            meta_bits.append(f"tools: {', '.join(tool_trace)}")
        if cascade_missing:
            meta_bits.append(f"cascade_missing: {cascade_missing}")
        if client_profile:
            meta_bits.append(f"client_profile: {client_profile!r}")
        if meta_bits:
            L.append("")
            L.append("> " + " · ".join(meta_bits))
        if cards:
            L.append("")
            L.append(f"**Карточек: {len(cards)}**")
            for i, c in enumerate(cards, 1):
                L.append(f"{i}. {card_label(c)} · флаги: {flag_summary(c)}")
        if expect:
            L.append("")
            L.append(f"_Ожидание: {expect}_")
        if err:
            L.append("")
            L.append(f"**Ошибка:** {err}")

    def to_session_json(self) -> Dict[str, Any]:
        first_user = next((m["content"] for m in self.messages if m["role"] == "user"), "")
        last = self.messages[-1]["content"] if self.messages else ""
        return {
            "id": self.cid,
            "title": short_title(f"Сц.{self.num} · {self.title}", 60),
            "lastMessage": short_title(last, 80),
            "timestamp": now_ms(),
            "messages": self.messages,
        }

    def write_md(self) -> Path:
        path = SCEN_DIR / f"sc-{self.num:02d}.md"
        body = [f"# Сценарий {self.num}: {self.title}",
                "",
                f"- conversation_id: `{self.cid}`",
                f"- запущен: {datetime.now().isoformat(timespec='seconds')}",
                f"- сообщений: {len(self.messages)}",
                f"- карточек в последнем ходе: {len(self.last_cards)}",
                f"- client_profile: `{self.client_profile or '—'}`",
                ""]
        if self.notes:
            body.append("## Заметки")
            body.append("")
            for n in self.notes:
                body.append(f"- {n}")
            body.append("")
        body.append("## Транскрипт")
        body.extend(self.transcript_lines)
        path.write_text("\n".join(body), encoding="utf-8")
        return path


# ---------- Scenarios ----------

def scenario_1(s: Scenario) -> None:
    """Каскад: 7 слотов по одному вопросу + поиск."""
    s.send(
        "Помоги подобрать тур клиенту. Задавай по одному уточняющему вопросу — соберём направление, вылет, даты, состав, категорию, питание и бюджет.",
        expect="Должен задать ровно один вопрос — про направление.",
    )
    s.send("Турция", expect="Спросит про вылет.")
    s.send("Москва", expect="Спросит про даты + длительность.")
    s.send("С 10 по 17 августа 2026, 7 ночей", expect="Спросит про состав.")
    s.send("2 взрослых, без детей", expect="Спросит про категорию + питание.")
    s.send("4-5 звёзд, всё включено", expect="Спросит про бюджет.")
    s.send(
        "До 250 000 рублей",
        expect="Сразу запустит search_tours без преамбулы 'секунду, ищу' и вернёт карточки.",
    )


def scenario_2(s: Scenario) -> None:
    """Vision: скриншот переписки → ТЗ → уточнение → запуск поиска."""
    img = make_screenshot_png([
        "Хотим в Турцию летом",
        "Анталья, август 2026",
        "Семья 2+1, ребёнку 6 лет",
        "Бюджет до 280 000 ₽, 7 ночей",
        "Песчаный пляж и всё включено",
        "Желательно 4-5 звёзд, Москва",
    ])
    s.send(
        "Вот переписка с клиентом — собери ТЗ.",
        images=[img],
        image_label="whatsapp-mock-720x880.png",
        expect="Должен распарсить и вернуть структурированное ТЗ + спросить 'поиск по этим параметрам или уточнить?'",
    )
    s.send(
        "Параметры верные, запускай поиск. Вылет из Москвы.",
        expect="Поиск должен быть запущен — каскад НЕ должен ругаться, summary картинки сохранён в истории.",
    )


def scenario_3(s: Scenario) -> None:
    """Профиль клиента: auto-extraction + match-флаги."""
    s.send(
        "У меня семья 2+1, ребёнку 6 лет, чувствительны к цене, нужен песчаный пляж.",
        expect="Признает семейный профиль; в client_profile появится текст.",
    )
    s.send(
        "Клиент в Турцию, август 2026, 7 ночей, вылет из Москвы. 4-5★, всё включено, до 250 000 ₽.",
        expect="Все 7 слотов одним сообщением → запуск поиска. На карточках должен появиться match_family.",
    )
    s.send(
        "Какой из них самый удобный для ребёнка 6 лет?",
        expect="Ответ должен опираться на профиль клиента.",
    )


def scenario_4(s: Scenario) -> None:
    """Recommend/match-бейджи на широкой выдаче."""
    s.send(
        "Профиль: пара 30 лет, спокойный отдых, без анимации, премиум.",
        expect="Профиль сохранится — пара.",
    )
    s.send(
        "Клиенту: Турция, Анталья, август 2026, 7 ночей, вылет Москва, 2 взрослых, 5★, всё включено, до 400 000 ₽.",
        expect="Поиск запустится. На карточках видны recommend_premium / recommend_optimum / recommend_budget + match_couple.",
    )


def scenario_5(s: Scenario) -> None:
    """Сравнение: 6 измерений + вердикт."""
    s.send(
        "Клиенту: семья 2+1, ребёнку 5 лет, Турция, Анталья, август 2026, 7 ночей, Москва, 4-5★, всё включено, до 300 000 ₽.",
        expect="Поиск с карточками.",
    )
    s.send(
        "Сравни первый и второй отель из выдачи: пляж, питание, рейтинг, цена. Кому какой подойдёт.",
        expect=(
            "6-измеренное сравнение (Локация / Пляж / Питание / Семья-Пара / Цена-качество / Перелёт) "
            "+ вердикт 'Мой выбор для вашего клиента: A или B, потому что …'."
        ),
    )


def scenario_6(s: Scenario) -> None:
    """Деталь отеля + актуализация цены."""
    s.send(
        "Клиент — пара 30 лет, 2 взрослых без детей. ОАЭ, Дубай, сентябрь 2026, 5 ночей, "
        "вылет из Москвы, 4-5★, завтраки или полупансион, до 250 000 ₽. Запускай поиск.",
        expect="Поиск по ОАЭ.",
    )
    s.send(
        "Расскажи про первый отель из выдачи — описание, пляж, питание, для кого подходит.",
        expect="Текстовое описание ОДНОГО отеля (без compare-формата). Без tourid/hotelcode.",
    )
    s.send(
        "Актуализируй цену третьего тура из выдачи — изменилась ли с момента поиска.",
        expect="Вызовет actualize_tour и вернёт «не изменилась / упала / выросла».",
    )


def scenario_7(s: Scenario, share_state: Dict[str, Any]) -> None:
    """Подборка + share-ссылка через POST /api/collection + аналитика."""
    s.send(
        "Клиент — семья 2 взрослых без детей. Кипр, июль 2026, 7 ночей, "
        "вылет из Москвы, 4★, полупансион, до 220 000 ₽. Запускай поиск.",
        expect="Поиск по Кипру.",
    )
    chosen = s.last_cards[:3] if s.last_cards else []
    s.append_local(
        f"Соберём подборку из {len(chosen) or '3'} вариантов для клиента.",
        "Готово — финальная подборка для клиента. Под этим сообщением кнопка «Поделиться подборкой» создаёт публичную HTML-ссылку.",
        cards=chosen,
        section="UI: «Собрать подборку»",
    )
    if chosen:
        try:
            coll = create_collection(
                title="Тестовая подборка для клиента (Кипр)",
                cards=chosen,
                note="Семья 2+0, июль 2026. Тестовый прогон.",
                conversation_id=s.cid,
            )
            share_url = coll.get("share_url") or coll.get("url") or ""
            cid_share = coll.get("collection_id") or coll.get("id") or ""
            share_state["url"] = share_url
            share_state["id"] = cid_share
            s.note(f"Коллекция создана: id={cid_share}, share_url={share_url}")
            s.append_local(
                "Поделись ссылкой клиенту.",
                f"Готово, share-ссылка: {share_url}\n\nОткрывается без логина и без следов TourVisor. Email-вариант: {share_url}/email",
                section="UI: share-ссылка",
            )
            # Открываем «как клиент» — увеличиваем счётчик
            try:
                _get(f"/share/{cid_share}", timeout=20)
                _get(f"/share/{cid_share}", timeout=20)
                stats_code, stats_body = _get(f"/api/collection/{cid_share}/stats", timeout=20)
                s.note(f"Статистика просмотров после двух открытий: HTTP {stats_code} — {stats_body}")
                s.append_local(
                    "Покажи аналитику просмотров подборки.",
                    f"Аналитика: {stats_body}",
                    section="UI: бейдж аналитики просмотров",
                )
            except Exception as e:
                s.note(f"Не удалось получить статистику: {e}")
        except Exception as e:
            s.note(f"Ошибка создания коллекции: {e}")


def scenario_8(s: Scenario) -> None:
    """Подборка недели — quick-action."""
    s.send(
        "Собери «Подборку недели» для соцсетей агентства: 5–6 интересных туров из текущих горящих предложений, "
        "разные страны и ценовые сегменты. Сразу сформируй её в чате как финальную (через build_collection с подходящим title), "
        "чтобы я мог взять share-ссылку и отправить клиентам/опубликовать.",
        expect=(
            "Должен сходить за get_hot_tours, выбрать 5-6, вызвать build_collection и вернуть готовую share-ссылку "
            "+ короткий пост с хэштегами для соцсетей."
        ),
    )


def scenario_9(s: Scenario) -> None:
    """Возражение «дорого» + WhatsApp-черновик."""
    s.send(
        "Клиент — пара 28 лет, 2 взрослых без детей. Греция, Крит, сентябрь 2026, "
        "7 ночей, вылет из Москвы, 4★, завтраки, до 200 000 ₽. Запускай поиск.",
        expect="Поиск по Греции.",
    )
    s.send(
        "Клиент говорит «дорого». Дай 2-3 короткие фразы и предложи альтернативу из текущей выдачи.",
        expect="Короткий ответ-аргументация + альтернатива (название отеля + цена) из last_cards.",
    )
    s.send(
        "Напиши клиенту WhatsApp по топ-3 из текущей выдачи — короткий драфт.",
        expect="Готовый текст без аббревиатур (BB/HB/AI), без ID/кодов, мягкий CTA «бронируем?».",
    )


def scenario_10(s: Scenario, memos_state: Dict[str, Any]) -> None:
    """Памятка по стране — LLM + endpoint."""
    s.send(
        "Дай мне памятку для клиента, который едет в Таиланд на 10 ночей. Виза, валюта, климат и 3 совета.",
        expect="Либо вызовет get_country_memo и вернёт структурированную памятку, либо ответит из своей базы знаний.",
    )
    code1, body1 = _get("/api/copilot/country-memos", timeout=20)
    memos_state["list_code"] = code1
    memos_state["list_len"] = len(body1)
    code2, body2 = _get("/api/copilot/country-memos/turkey", timeout=20)
    memos_state["turkey_code"] = code2
    memos_state["turkey_len"] = len(body2)
    s.note(f"GET /api/copilot/country-memos → {code1}, {len(body1)} bytes")
    s.note(f"GET /api/copilot/country-memos/turkey → {code2}, {len(body2)} bytes")


def scenario_11(s: Scenario) -> None:
    """Длинный диалог: refine + сравнение + WhatsApp в одной сессии."""
    s.send(
        "Семья 2+1, ребёнку 4, Турция, Анталья, август 2026, 7 ночей, Москва, до 250 000 ₽, всё включено, 4-5★.",
        expect="Все слоты одним сообщением — должен быть прямой поиск.",
    )
    s.send("Дай дешевле — до 200 000 ₽.", expect="Refine-поиск: новые карточки.")
    s.send("Те же варианты, но 5★.", expect="Ещё refine.")
    s.send("Сравни 1 и 2.", expect="6-измеренное сравнение.")
    s.send("Напиши клиенту WhatsApp по топ-2.", expect="Готовый драфт без аббревиатур.")


def scenario_12(s: Scenario) -> None:
    """Горящие туры — быстрый сценарий."""
    s.send(
        "Покажи горящие туры из Москвы — что есть прямо сейчас.",
        expect="Должен вызвать get_hot_tours и вернуть карточки горящих с фактовыми бейджами.",
    )


def scenario_13(s: Scenario) -> None:
    """Edge-case — заведомо пустая или нереалистичная выдача."""
    s.send(
        "Клиенту: 2 взрослых, Антарктида, август 2026, 7 ночей, вылет Москва, 5★, всё включено, до 80 000 ₽.",
        expect=(
            "Должен либо честно сказать 'таких параметров TourVisor не возвращает', либо отказать "
            "по бюджету/направлению. Не должен выдумать туры."
        ),
    )


SCENARIOS_DEF = [
    (1, "Каскад из 7 слотов", scenario_1),
    (2, "Vision: скриншот переписки", scenario_2),
    (3, "Профиль клиента + match-флаги (семья)", scenario_3),
    (4, "Recommend-бейджи (премиум-пара)", scenario_4),
    (5, "Сравнение 1 и 2 (6 измерений)", scenario_5),
    (6, "Деталь отеля + актуализация цены", scenario_6),
    (7, "Подборка + share-ссылка + аналитика", scenario_7),
    (8, "Подборка недели", scenario_8),
    (9, "Возражение «дорого» + WhatsApp", scenario_9),
    (10, "Памятка по стране (Таиланд)", scenario_10),
    (11, "Длинный диалог: refine + сравнение + WhatsApp", scenario_11),
    (12, "Горящие туры", scenario_12),
    (13, "Edge-case: нереальные параметры", scenario_13),
]


# ---------- Main ----------

def main() -> int:
    selector = sys.argv[1] if len(sys.argv) > 1 else ""
    only: Optional[set] = None
    if selector:
        only = {int(x) for x in selector.split(",") if x.strip()}

    seed_path = HERE / "sessions.json"
    existing_sessions: List[Dict[str, Any]] = []
    if only is not None and seed_path.exists():
        try:
            existing_sessions = json.loads(seed_path.read_text(encoding="utf-8"))
            print(f"merge: подгружено {len(existing_sessions)} сессий из {seed_path.name}")
        except Exception as e:
            print(f"merge: не смог прочитать seed ({e}), стартую с нуля")
            existing_sessions = []

    def _scen_num_of(sess: Dict[str, Any]) -> Optional[int]:
        title = sess.get("title", "")
        if title.startswith("Сц."):
            tail = title[3:].split("·", 1)[0].strip()
            try:
                return int(tail)
            except ValueError:
                return None
        return None

    if only is not None and existing_sessions:
        existing_sessions = [s for s in existing_sessions if _scen_num_of(s) not in only]

    sessions: List[Dict[str, Any]] = list(existing_sessions)
    summary_rows: List[Tuple[int, str, str, int, str]] = []
    share_state: Dict[str, Any] = {}
    memos_state: Dict[str, Any] = {}

    for num, title, fn in SCENARIOS_DEF:
        if only is not None and num not in only:
            continue
        print(f"\n=== Сценарий {num}: {title} ===", flush=True)
        s = Scenario(num, title)
        t0 = time.time()
        status = "ok"
        try:
            if num == 7:
                fn(s, share_state)
            elif num == 10:
                fn(s, memos_state)
            else:
                fn(s)
        except Exception as e:
            status = f"FAIL: {type(e).__name__}: {e}"
            s.note(f"Прервано: {status}")
        elapsed = time.time() - t0
        path = s.write_md()
        sess = s.to_session_json()
        sessions.append(sess)
        cards = sum(1 for m in s.messages if m.get("tour_cards"))
        print(f"   ↳ {len(s.messages)} сообщений, {cards} с карточками, {elapsed:.1f}s, status={status}")
        print(f"   ↳ MD: {path.relative_to(HERE)}")
        summary_rows.append((num, title, status, len(s.messages), f"{elapsed:.1f}s"))

    # Сохраняем localStorage seed (стабильный порядок по номеру сценария)
    sessions.sort(key=lambda s: _scen_num_of(s) or 999)
    seed_path.write_text(json.dumps(sessions, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nlocalStorage seed: {seed_path} (sessions: {len(sessions)})")

    # REPORT.md
    report_lines = [
        "# Отчёт по прогону сценариев",
        "",
        f"- дата запуска: {datetime.now().isoformat(timespec='seconds')}",
        f"- backend: {API}",
        f"- всего сценариев: {len(summary_rows)}",
        "",
        "| # | Сценарий | Сообщений | Время | Статус |",
        "|---|----------|-----------|-------|--------|",
    ]
    for num, title, status, mcount, dur in summary_rows:
        report_lines.append(f"| {num} | {title} | {mcount} | {dur} | {status} |")
    if share_state:
        report_lines.extend(["", "## Подборка (Сц.7)", "",
                             f"- collection_id: `{share_state.get('id')}`",
                             f"- share_url: {share_state.get('url')}"])
    if memos_state:
        report_lines.extend(["", "## Памятки (Сц.10)", "",
                             f"- /api/copilot/country-memos → HTTP {memos_state.get('list_code')}, {memos_state.get('list_len')} bytes",
                             f"- /api/copilot/country-memos/turkey → HTTP {memos_state.get('turkey_code')}, {memos_state.get('turkey_len')} bytes"])
    (HERE / "REPORT.md").write_text("\n".join(report_lines), encoding="utf-8")
    print(f"REPORT.md: {HERE / 'REPORT.md'}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
