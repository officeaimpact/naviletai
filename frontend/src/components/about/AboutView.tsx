"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, X, Calendar, ChevronRight } from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" } },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.07 } },
};

const STATS = [
  { value: "3+", label: "года в AI и туризме" },
  { value: "100+", label: "туроператоров" },
  { value: "24/7", label: "онлайн" },
];

const TOURVISOR_STATS = [
  { value: "100+", label: "туроператоров" },
  { value: "50+", label: "стран" },
  { value: "500+", label: "курортов" },
];

const PARTNERS = [
  { name: "РСТ", full: "Российский союз туриндустрии", logo: "/partners/rst-logo.png" },
  { name: "ТПП РФ", full: "Торгово-промышленная палата РФ", logo: "/partners/tpp-logo.svg" },
  { name: "РЭУ Плеханова", full: "РЭУ им. Г.В. Плеханова", logo: "/partners/plekhanov-logo.png" },
  { name: "МГИМО", full: "МГИМО МИД России", logo: "/partners/mgimo-logo.svg" },
];

const EVENTS = [
  {
    id: "congress-sochi-2025",
    title: "III Международный конгресс туроператоров",
    date: "25–27 ноября 2025",
    location: "Сочи, Газпром Поляна",
    description: "Навылет AI представит доклад о применении искусственного интеллекта в работе туроператоров и турагентств на крупнейшем отраслевом конгрессе.",
    tags: ["Выступление", "Международный"],
  },
  {
    id: "dagestan-forum-2025",
    title: "Всероссийский форум «Открытый Дагестан»",
    date: "25–28 сентября 2025",
    location: "Махачкала, Дагестан",
    description: "Участие в панельной дискуссии о цифровой трансформации внутреннего туризма и презентация AI-решений для региональных турагентств.",
    tags: ["Выступление", "Всероссийский"],
  },
  {
    id: "congress-turoperators-2025",
    title: "Международный конгресс туроператоров",
    date: "9–11 октября 2025",
    location: "Москва",
    description: "AIMPACT представила кейсы внедрения AI-турассистента в крупнейших турагентствах России и результаты автоматизации клиентского сервиса.",
    tags: ["Выступление", "Международный"],
  },
  {
    id: "tpp-ai-council-2025",
    title: "Совет ТПП РФ по применению AI в бизнесе",
    date: "28 апреля 2025",
    location: "Москва, ТПП РФ",
    description: "Доклад сооснователя Евгения Ребеко о практическом применении AI в туристическом бизнесе и перспективах развития технологий в отрасли.",
    tags: ["Выступление", "AI"],
  },
  {
    id: "sochi-conference-2025",
    title: "Конференция «Туризм и дестинации»",
    date: "29–30 мая 2025",
    location: "Сочи",
    description: "Презентация AI-платформы навылет как инструмента повышения конверсии и автоматизации продаж в туристических компаниях.",
    tags: ["Выступление"],
  },
  {
    id: "minsk-congress-2025",
    title: "Международный конгресс в Минске",
    date: "9 апреля 2025",
    location: "Минск, Беларусь",
    description: "Совместное выступление AIMPACT и генерального директора «Сети магазинов горящих путёвок» Сергея Агафонова о результатах внедрения AI в работу крупнейшей турсети.",
    tags: ["Выступление", "Международный"],
  },
  {
    id: "reu-forum-2025",
    title: "Форум в РЭУ им. Плеханова",
    date: "17 февраля 2025",
    location: "Москва, РЭУ",
    description: "Выступление о подготовке кадров для работы с AI-технологиями в индустрии гостеприимства и туризма. Представлены 3 кейса: KareliaGid, ТУРПОМОЩЬ, гостиничный сектор.",
    tags: ["Образование", "AI"],
  },
  {
    id: "tpp-meeting-2023",
    title: "Итоговое заседание Комитета ТПП РФ",
    date: "18 декабря 2023",
    location: "Москва, ТПП РФ",
    description: "Почётная благодарность от вице-президента РСТ Юрия Барзыкина и заместителя председателя комитета Госдумы Натальи Костенко за вклад в развитие AI-технологий в туризме.",
    tags: ["Награждение"],
  },
  {
    id: "aktau-forum-2023",
    title: "I Международный форум в Актау",
    date: "16 сентября 2023",
    location: "Актау, Казахстан",
    description: "Первое международное выступление AIMPACT с презентацией концепции AI-турассистента на форуме с участием делегаций из 12 стран.",
    tags: ["Международный"],
  },
];

type EventType = typeof EVENTS[number];

function EventModal({ event, onClose }: { event: EventType; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/50" />
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 10 }}
        transition={{ type: "spring", damping: 28, stiffness: 350 }}
        onClick={(e) => e.stopPropagation()}
        className="relative bg-background rounded-2xl overflow-hidden shadow-2xl max-w-lg w-full max-h-[85vh] flex flex-col"
      >
        <div className="relative aspect-[16/9] bg-muted shrink-0">
          <img
            src={`/events/${event.id}.png`}
            alt={event.title}
            className="w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-1.5 rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-3 overflow-y-auto">
          <div className="flex items-center gap-2 text-xs text-brand font-medium">
            <Calendar className="h-3.5 w-3.5" />
            {event.date}
          </div>
          <h2 className="text-lg font-bold leading-snug">{event.title}</h2>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            {event.location}
          </div>
          <p className="text-sm text-foreground/85 leading-relaxed">{event.description}</p>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {event.tags.map((tag) => (
              <span key={tag} className="text-[10px] px-2.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                {tag}
              </span>
            ))}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function EventCard({ event, onClick }: { event: EventType; onClick: () => void }) {
  return (
    <motion.article
      variants={fadeUp}
      onClick={onClick}
      className="group rounded-xl border border-border/40 overflow-hidden bg-background cursor-pointer
                 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
    >
      <div className="relative aspect-[16/10] bg-muted overflow-hidden">
        <img
          src={`/events/${event.id}.png`}
          alt={event.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
      </div>
      <div className="p-3.5 space-y-1.5">
        <p className="text-[11px] font-medium text-brand">{event.date}</p>
        <h3 className="text-sm font-semibold leading-snug group-hover:text-brand transition-colors">
          {event.title}
        </h3>
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <MapPin className="h-3 w-3 shrink-0" />
          <span className="truncate">{event.location}</span>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-brand/70 font-medium pt-0.5">
          <span>Подробнее</span>
          <ChevronRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
        </div>
      </div>
    </motion.article>
  );
}

export function AboutView() {
  const [selectedEvent, setSelectedEvent] = useState<EventType | null>(null);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-14">

        {/* ── About ── */}
        <motion.section variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true }}>
          <motion.h1 variants={fadeUp} className="text-xl font-bold tracking-tight mb-5">
            О нас
          </motion.h1>

          <motion.div variants={fadeUp} className="space-y-4 text-sm text-foreground/85 leading-relaxed">
            <p>
              Навылет — это инновационная AI-платформа и ваш личный ассистент по планированию
              путешествий. Мы знаем, как утомительно тратить часы на поиск подходящего тура,
              поэтому создали сервис, который делает всё за вас — прямо в формате удобного диалога.
            </p>
            <p>
              Вы просто рассказываете о своих пожеланиях: куда хотите поехать, в какие даты
              и с каким бюджетом. Наш AI-ассистент задаст пару уточняющих вопросов
              и за считанные минуты подберёт 3–5 лучших вариантов туров и отелей
              из предложений более 100 туроператоров. Никаких сложных фильтров —
              от первого запроса до готовых предложений вас отделяет всего 3–4 простых шага.
            </p>
            <p>
              Навылет — это технологичный мост между вами и вашим отдыхом. Как только мы
              находим идеальный вариант, мы мгновенно и безопасно переводим вас на оформление
              к нашему партнёру — без каких-либо доплат и скрытых комиссий.
            </p>
            <p>
              Мы сотрудничаем только с проверенными компаниями, включая крупнейшие туристические
              сети России с более чем 20-летним опытом на рынке. Вашу заявку подхватывают
              профессионалы с колоссальным опытом в индустрии. Навылет объединяет скорость
              современных технологий и многолетнюю надёжность профессионалов рынка туризма.
              Доверьте планирование нам, а сами просто собирайте чемодан.
            </p>
          </motion.div>

          <motion.div variants={stagger} className="grid grid-cols-3 gap-3 mt-6">
            {STATS.map((s) => (
              <motion.div
                key={s.label}
                variants={fadeUp}
                className="rounded-xl border border-border/40 py-3 px-2 text-center"
              >
                <p className="text-xl font-bold text-brand">{s.value}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{s.label}</p>
              </motion.div>
            ))}
          </motion.div>

          <motion.p variants={fadeUp} className="text-[10px] text-muted-foreground/40 mt-6">
            Продукт компании AIMPACT+ (ООО «ИИМПАКТ ПЛЮС») · ИНН 9705243471 · ОГРН 1257700255196 · Москва
          </motion.p>
        </motion.section>

        {/* ── Partners ── */}
        <motion.section variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true }}>
          <motion.h2 variants={fadeUp} className="text-lg font-bold tracking-tight mb-5">
            Партнёры
          </motion.h2>

          <motion.div variants={fadeUp} className="rounded-xl border-2 border-brand/15 bg-brand/[0.02] p-5 mb-5">
            <div className="flex items-start gap-4">
              <img
                src="/brand/tourvisor-ai-logo.png"
                alt="TourVisor"
                className="h-12 w-auto object-contain bg-white p-1.5 rounded-lg border border-border/20 shrink-0"
              />
              <div className="min-w-0">
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-brand/10 text-brand">
                  Технологический партнёр
                </span>
                <h3 className="text-sm font-bold mt-1.5">TourVisor</h3>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Поисково-аналитическая платформа для турагентов. Подбор туров по 100+
                  туроператорам, актуализация цен и оформление бронирования в одном окне.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 mt-4 pt-3 border-t border-border/20">
              {TOURVISOR_STATS.map((s) => (
                <div key={s.label} className="text-center">
                  <p className="text-sm font-bold text-brand">{s.value}</p>
                  <p className="text-[10px] text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div variants={stagger} className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {PARTNERS.map((p) => (
              <motion.div
                key={p.name}
                variants={fadeUp}
                whileHover={{ y: -4, scale: 1.03 }}
                transition={{ type: "spring", stiffness: 400, damping: 20 }}
                className="rounded-xl border border-border/40 p-4 flex flex-col items-center text-center gap-2.5
                           cursor-default hover:shadow-md hover:border-brand/30 transition-shadow"
              >
                <img
                  src={p.logo}
                  alt={p.full}
                  className="h-10 w-auto object-contain grayscale hover:grayscale-0 transition-all duration-300"
                  loading="lazy"
                />
                <p className="text-[11px] font-medium leading-tight">{p.full}</p>
              </motion.div>
            ))}
          </motion.div>
        </motion.section>

        {/* ── Events ── */}
        <motion.section variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true }}>
          <motion.h2 variants={fadeUp} className="text-lg font-bold tracking-tight mb-1">
            Мероприятия
          </motion.h2>
          <motion.p variants={fadeUp} className="text-xs text-muted-foreground mb-5">
            Ключевые события с участием команды
          </motion.p>

          <motion.div variants={stagger} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {EVENTS.map((event) => (
              <EventCard key={event.id} event={event} onClick={() => setSelectedEvent(event)} />
            ))}
          </motion.div>
        </motion.section>

        <div className="h-6" />
      </div>

      <AnimatePresence>
        {selectedEvent && (
          <EventModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
