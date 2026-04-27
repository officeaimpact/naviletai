"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Clock, MessageSquare, ShieldCheck, Globe, Flame, Building2,
  HelpCircle, Plane, RefreshCw, Car, Layers, Users, BarChart3,
  Palette, Activity, Code, ArrowRight, ExternalLink, Mail, Phone,
  Send, Star, Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import HeroChatWidget from "./HeroChatWidget";
import DashboardPreview from "./DashboardPreview";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" } },
};
const stagger = { visible: { transition: { staggerChildren: 0.06 } } };

const METRICS = [
  { value: "3–30 сек", label: "ответ" },
  { value: "90%+", label: "точность" },
  { value: "24/7", label: "онлайн" },
  { value: "1 день", label: "интеграция" },
];

const PROBLEMS = [
  { icon: Clock, stat: "70%", text: "заявок теряются — клиент пишет в 23:00, а менеджер ответит утром" },
  { icon: RefreshCw, stat: "15–40 мин", text: "на подбор одного тура — ручной поиск, фильтры, сравнение" },
  { icon: MessageSquare, stat: "80%", text: "рутинных вопросов — визы, питание, документы отнимают время" },
];

const FEATURES = [
  { icon: Globe, title: "Подбор туров", desc: "50+ стран, 500+ курортов, тысячи отелей" },
  { icon: Flame, title: "Горящие туры", desc: "Мгновенная выдача по городу вылета" },
  { icon: Building2, title: "Поиск по отелю", desc: "Fuzzy-matching, транслитерация" },
  { icon: Star, title: "Консультация", desc: "Территория, пляж, детская инфраструктура" },
  { icon: Plane, title: "Перелёты", desc: "Авиакомпании, время, аэропорты, пересадки" },
  { icon: RefreshCw, title: "Актуализация цен", desc: "Реальная стоимость с доплатами" },
  { icon: Car, title: "Без перелёта", desc: "Поездка на машине или автобусе" },
  { icon: ShieldCheck, title: "15+ safety-nets", desc: "Автокоррекция дат, бюджета, ошибок" },
  { icon: Layers, title: "Каскадный диалог", desc: "Не переспрашивает то, что уже известно" },
  { icon: Globe, title: "Мультистрана", desc: "Турция или Египет — оба в одном диалоге" },
  { icon: Users, title: "Группы и семьи", desc: "Понимает «вдвоём», «семьёй», «нас 8»" },
  { icon: HelpCircle, title: "FAQ", desc: "Визы, погода, документы без менеджера" },
];

const DASHBOARD_FEATURES = [
  { icon: BarChart3, title: "Аналитика", desc: "Графики, воронки, тепловые карты, CSV" },
  { icon: MessageSquare, title: "Диалоги", desc: "Replay чатов, профиль клиента, фильтры" },
  { icon: Palette, title: "Кастомизация", desc: "Цвета, логотип — белый лейбл" },
  { icon: Activity, title: "Мониторинг", desc: "Статус системы, аптайм, алерты" },
];

const STEPS = [
  { num: "1", title: "Встраиваете виджет", desc: "Одна строка кода на ваш сайт" },
  { num: "2", title: "Настраиваете бренд", desc: "Логотип, цвета, приветственное сообщение" },
  { num: "3", title: "Запускаете", desc: "Ассистент обрабатывает заявки, вы следите в ЛК" },
];

const PLANS = [
  { name: "Старт", price: "14 990", dialogs: "100", features: ["AI-ассистент 24/7", "Веб-виджет", "Личный кабинет", "Email-поддержка"], popular: false },
  { name: "Рост", price: "29 990", dialogs: "300", features: ["AI-ассистент 24/7", "Веб-виджет", "ЛК с аналитикой", "Кастомизация виджета", "Чат-поддержка"], popular: true },
  { name: "Профи", price: "39 990", dialogs: "500", features: ["AI-ассистент 24/7", "Веб-виджет", "Расширенная аналитика", "Кастомизация виджета", "Приоритетная поддержка"], popular: false },
  { name: "Максимум", price: "64 990", dialogs: "1 000", features: ["AI-ассистент 24/7", "Веб-виджет", "Полная аналитика", "Кастомизация виджета", "Персональный менеджер"], popular: false },
];


const PARTNERS_LOGOS = [
  { name: "ТПП РФ", logo: "/partners/tpp-logo.svg" },
  { name: "РСТ", logo: "/partners/rst-logo.png" },
  { name: "РЭУ Плеханова", logo: "/partners/plekhanov-logo.png" },
  { name: "МГИМО", logo: "/partners/mgimo-logo.svg" },
];

function SectionTitle({ children, subtitle }: { children: React.ReactNode; subtitle?: string }) {
  return (
    <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-40px" }}>
      <h2 className="text-lg font-bold tracking-tight">{children}</h2>
      {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
    </motion.div>
  );
}

export function PartnersView() {
  const [formSent, setFormSent] = useState(false);
  const [formData, setFormData] = useState({ name: "", email: "", phone: "", company: "" });

  const handleFormSubmit = () => {
    const { name, email, phone, company } = formData;
    if (!name || !email) return;
    const subject = encodeURIComponent("Заявка на подключение навылет AI");
    const body = encodeURIComponent(
      `Имя: ${name}\nEmail: ${email}\nТелефон: ${phone}\nКомпания: ${company}`
    );
    window.open(`mailto:office@aimpact.ru?subject=${subject}&body=${body}`, "_blank");
    setFormSent(true);
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-14">

        {/* ── Hero ── */}
        <motion.section variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true }}>
          <motion.div variants={fadeUp} className="space-y-3">
            <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-brand/10 text-brand">
              B2B · TourVisor
            </span>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight leading-snug">
              AI-турменеджер для вашего бизнеса
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xl">
              Подключите интеллектуального ассистента навылет к своему сайту —
              он подберёт туры, проконсультирует по отелям и перелётам в живом
              диалоге с клиентом. Интеграция за 1 день.
            </p>
          </motion.div>

          <motion.div variants={fadeUp} className="flex gap-2.5 mt-5">
            <a href="#demo" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand text-white text-sm font-medium hover:bg-brand-dark transition-colors">
              Попробовать демо
            </a>
            <a href="#contact" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors">
              Оставить заявку
            </a>
          </motion.div>

          <motion.div variants={stagger} className="grid grid-cols-4 gap-2.5 mt-6">
            {METRICS.map((m) => (
              <motion.div key={m.label} variants={fadeUp} whileHover={{ y: -3, scale: 1.03 }} transition={{ type: "spring", stiffness: 400, damping: 20 }} className="rounded-lg border border-border/40 py-2.5 px-2 text-center cursor-default hover:shadow-md hover:border-brand/30 transition-shadow">
                <p className="text-sm font-bold text-brand">{m.value}</p>
                <p className="text-[10px] text-muted-foreground">{m.label}</p>
              </motion.div>
            ))}
          </motion.div>
        </motion.section>

        {/* ── Problems ── */}
        <motion.section variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true }}>
          <SectionTitle subtitle="С чем сталкиваются турагентства каждый день">Знакомая ситуация?</SectionTitle>
          <motion.div variants={stagger} className="grid gap-3 mt-5">
            {PROBLEMS.map((p) => (
              <motion.div key={p.stat} variants={fadeUp} whileHover={{ y: -2, scale: 1.01 }} transition={{ type: "spring", stiffness: 400, damping: 20 }} className="flex items-start gap-3 rounded-xl border border-border/40 p-4 cursor-default hover:shadow-md hover:border-red-300/40 transition-shadow">
                <div className="h-9 w-9 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0">
                  <p.icon className="h-4 w-4 text-red-500" />
                </div>
                <div>
                  <span className="text-sm font-bold text-red-500">{p.stat}</span>
                  <span className="text-sm text-foreground/85 ml-1.5">{p.text}</span>
                </div>
              </motion.div>
            ))}
          </motion.div>
          <motion.div variants={fadeUp} className="rounded-xl bg-brand/5 border border-brand/20 p-4 mt-4">
            <p className="text-sm text-foreground/85 leading-relaxed">
              <strong className="text-brand">Навылет</strong> берёт рутину на себя — обрабатывает
              заявки круглосуточно, подбирает туры за секунды и передаёт готового клиента менеджеру.
            </p>
          </motion.div>
        </motion.section>

        {/* ── Chat Widget Preview ── */}
        <motion.section id="demo" variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true }}>
          <SectionTitle subtitle="Посмотрите, как ассистент ведёт реальный диалог с клиентом">Как это выглядит</SectionTitle>
          <motion.div variants={fadeUp} className="mt-5 flex justify-center">
            <HeroChatWidget className="w-full max-w-[420px]" />
          </motion.div>
          <motion.div variants={fadeUp} className="mt-4 text-center">
            <p className="text-[10px] text-muted-foreground">
              Виджет подключается одной строкой кода и настраивается под ваш бренд
            </p>
          </motion.div>
        </motion.section>

        {/* ── Features ── */}
        <motion.section variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true }}>
          <SectionTitle subtitle="Всё, что умеет AI-ассистент">Возможности</SectionTitle>
          <motion.div variants={stagger} className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-5">
            {FEATURES.map((f) => (
              <motion.div key={f.title} variants={fadeUp} whileHover={{ y: -3, scale: 1.02 }} transition={{ type: "spring", stiffness: 400, damping: 20 }} className="flex items-start gap-3 rounded-xl border border-border/40 p-3.5 cursor-default hover:shadow-md hover:border-brand/30 transition-shadow">
                <f.icon className="h-4 w-4 text-brand shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold">{f.title}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{f.desc}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </motion.section>

        {/* ── Dashboard: Overview ── */}
        <motion.section variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true }}>
          <SectionTitle subtitle="Полный контроль в одном месте">Личный кабинет — Обзор</SectionTitle>
          <motion.div variants={stagger} className="grid grid-cols-2 gap-2.5 mt-5">
            {DASHBOARD_FEATURES.map((d) => (
              <motion.div key={d.title} variants={fadeUp} whileHover={{ y: -3, scale: 1.03 }} transition={{ type: "spring", stiffness: 400, damping: 20 }} className="rounded-xl border border-border/40 p-4 text-center space-y-2 cursor-default hover:shadow-md hover:border-brand/30 transition-shadow">
                <d.icon className="h-5 w-5 text-brand mx-auto" />
                <p className="text-xs font-semibold">{d.title}</p>
                <p className="text-[10px] text-muted-foreground">{d.desc}</p>
              </motion.div>
            ))}
          </motion.div>
          <motion.div variants={fadeUp} className="mt-4">
            <DashboardPreview initialScreen="overview" />
          </motion.div>
        </motion.section>

        {/* ── Dashboard: Analytics ── */}
        <motion.section variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true }}>
          <SectionTitle subtitle="Понимайте спрос лучше, чем конкуренты">Глубокая аналитика</SectionTitle>
          <motion.div variants={fadeUp} className="space-y-3 mt-5 mb-4">
            {[
              "География спроса: популярные страны и города вылета",
              "Тепловая карта активности 7×24: когда клиенты обращаются",
              "Матрица звёздность × питание: какие комбинации популярнее",
              "Быстрые AI-инсайты на основе данных",
            ].map((item) => (
              <div key={item} className="flex items-start gap-2">
                <Check className="h-3.5 w-3.5 text-brand shrink-0 mt-0.5" />
                <p className="text-xs text-foreground/80">{item}</p>
              </div>
            ))}
          </motion.div>
          <motion.div variants={fadeUp}>
            <DashboardPreview initialScreen="analytics" />
          </motion.div>
        </motion.section>

        {/* ── Integration ── */}
        <motion.section variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true }}>
          <SectionTitle subtitle="Три простых шага">Подключение за 1 день</SectionTitle>
          <motion.div variants={stagger} className="space-y-3 mt-5">
            {STEPS.map((s) => (
              <motion.div key={s.num} variants={fadeUp} className="flex items-start gap-4">
                <div className="h-8 w-8 rounded-full bg-brand text-white flex items-center justify-center text-sm font-bold shrink-0">
                  {s.num}
                </div>
                <div>
                  <p className="text-sm font-semibold">{s.title}</p>
                  <p className="text-xs text-muted-foreground">{s.desc}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
          <motion.div variants={fadeUp} whileHover={{ scale: 1.01 }} transition={{ type: "spring", stiffness: 400, damping: 20 }} className="mt-5 rounded-xl bg-muted/30 border border-border/40 p-4 hover:shadow-md hover:border-brand/20 transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Code className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground font-mono">HTML</span>
              </div>
              <button
                onClick={() => navigator.clipboard.writeText('<script src="https://widget.navilet.ru/loader.js" data-assistant-id="YOUR_ID" async></script>')}
                className="text-[10px] text-brand hover:underline"
              >
                Скопировать
              </button>
            </div>
            <code className="text-xs text-foreground/80 font-mono break-all leading-relaxed">
              {'<script src="https://widget.navilet.ru/loader.js" data-assistant-id="YOUR_ID" async></script>'}
            </code>
          </motion.div>
        </motion.section>

        {/* ── Institutional Support ── */}
        <motion.section variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true }}>
          <SectionTitle>Институциональная поддержка</SectionTitle>
          <motion.div variants={fadeUp} className="rounded-xl border-2 border-brand/15 bg-brand/[0.02] p-5 mt-5 space-y-4">
            <div className="flex items-start gap-3">
              <ShieldCheck className="h-5 w-5 text-brand shrink-0 mt-0.5" />
              <p className="text-sm text-foreground/85 leading-relaxed">
                Проект навылет имеет поддержку председателя Комитета ТПП РФ по предпринимательству
                в сфере туризма <strong>Юрия Александровича Барзыкина</strong>. Команда AIMPACT+
                удостоена почётной благодарности за вклад в развитие AI-технологий в туризме
                от вице-президента РСТ и заместителя председателя комитета Государственной Думы.
              </p>
            </div>
            <div className="flex items-center gap-5 pt-2 border-t border-border/20">
              {PARTNERS_LOGOS.map((p) => (
                <img key={p.name} src={p.logo} alt={p.name} className="h-8 w-auto object-contain grayscale opacity-60" loading="lazy" />
              ))}
            </div>
          </motion.div>
        </motion.section>

        {/* ── Pricing ── */}
        <motion.section variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true }}>
          <SectionTitle subtitle="Выберите подходящий план">Тарифы</SectionTitle>
          <motion.div variants={stagger} className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5">
            {PLANS.map((plan) => (
              <motion.div
                key={plan.name}
                variants={fadeUp}
                whileHover={{ y: -4, scale: 1.02 }}
                transition={{ type: "spring", stiffness: 400, damping: 20 }}
                className={`rounded-xl border p-4 space-y-3 cursor-default hover:shadow-lg transition-shadow ${
                  plan.popular
                    ? "border-brand/40 bg-brand/[0.03] ring-1 ring-brand/20 hover:shadow-brand/10"
                    : "border-border/40 hover:border-brand/20"
                }`}
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold">{plan.name}</h3>
                  {plan.popular && (
                    <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-brand/10 text-brand">
                      Популярный
                    </span>
                  )}
                </div>
                <div>
                  <span className="text-xl font-bold">{plan.price} ₽</span>
                  <span className="text-xs text-muted-foreground"> / мес</span>
                </div>
                <p className="text-xs text-muted-foreground">{plan.dialogs} диалогов в месяц</p>
                <ul className="space-y-1.5">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-xs text-foreground/80">
                      <Check className="h-3 w-3 text-brand shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </motion.div>
          <motion.div variants={fadeUp} className="text-center mt-4 space-y-1">
            <p className="text-xs text-muted-foreground">Установочный платёж: 14 990 ₽ (разово)</p>
            <p className="text-xs text-brand font-medium">7 дней бесплатно, без привязки карты</p>
          </motion.div>
        </motion.section>

        {/* ── CTA / Contact ── */}
        <motion.section id="contact" variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true }}>
          <SectionTitle subtitle="Мы свяжемся в течение дня">Готовы попробовать?</SectionTitle>
          <motion.div variants={stagger} className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5">
            <motion.div variants={fadeUp} whileHover={{ y: -2 }} transition={{ type: "spring", stiffness: 400, damping: 20 }} className="rounded-xl border border-border/40 p-5 space-y-3 hover:shadow-md hover:border-brand/20 transition-shadow">
              {formSent ? (
                <div className="text-center py-6 space-y-2">
                  <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
                    <Check className="h-5 w-5 text-green-600" />
                  </div>
                  <p className="text-sm font-semibold">Заявка отправлена!</p>
                  <p className="text-xs text-muted-foreground">Мы свяжемся с вами в ближайшее время</p>
                </div>
              ) : (
                <>
                  <p className="text-sm font-semibold">Оставить заявку</p>
                  <Input
                    placeholder="Имя"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="h-9 text-sm"
                  />
                  <Input
                    placeholder="Email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="h-9 text-sm"
                  />
                  <Input
                    placeholder="Телефон"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="h-9 text-sm"
                  />
                  <Input
                    placeholder="Компания"
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    className="h-9 text-sm"
                  />
                  <Button onClick={handleFormSubmit} className="w-full bg-brand hover:bg-brand-dark text-white h-9">
                    <Send className="h-3.5 w-3.5 mr-2" />
                    Отправить
                  </Button>
                </>
              )}
            </motion.div>

            <motion.div variants={fadeUp} whileHover={{ y: -2 }} transition={{ type: "spring", stiffness: 400, damping: 20 }} className="rounded-xl border border-border/40 p-5 flex flex-col justify-between hover:shadow-md hover:border-brand/20 transition-shadow">
              <div className="space-y-3">
                <p className="text-sm font-semibold">Подробнее на navilet.ru</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Интерактивное демо, документация, кейсы внедрения и личный кабинет
                  для управления AI-ассистентом.
                </p>
                <a
                  href="https://navilet.ru"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-brand font-medium hover:underline"
                >
                  Перейти на navilet.ru <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
              <div className="space-y-2 mt-5 pt-4 border-t border-border/30">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Mail className="h-3.5 w-3.5" /> office@aimpact.ru
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Phone className="h-3.5 w-3.5" /> +7 (963) 799-79-77
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <ArrowRight className="h-3.5 w-3.5" /> Telegram: @navylet_ai
                </div>
              </div>
            </motion.div>
          </motion.div>
        </motion.section>

        <div className="h-6" />
      </div>
    </div>
  );
}
