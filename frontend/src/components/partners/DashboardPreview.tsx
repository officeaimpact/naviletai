"use client";

import { useState } from "react";
import {
  LayoutDashboard, MessageSquare, BarChart3, Code2, Activity, UserCircle,
  Search, Clock, TrendingUp, TrendingDown, MessagesSquare, BookmarkCheck,
  Zap, Globe, MapPin, Calendar, Users,
} from "lucide-react";

const C = "#0038FF";

type Screen = "overview" | "analytics";

const NAV = [
  { id: "overview", icon: LayoutDashboard, label: "Обзор" },
  { id: "conversations", icon: MessageSquare, label: "Диалоги" },
  { id: "analytics", icon: BarChart3, label: "Аналитика" },
  { id: "widget", icon: Code2, label: "Виджет" },
  { id: "system", icon: Activity, label: "Система" },
  { id: "account", icon: UserCircle, label: "Аккаунт" },
];

/* ═══════ OVERVIEW DATA ═══════ */

const SPARKLINES = {
  conv: "0,18 8,16 16,14 24,15 32,11 40,13 48,9 56,7 64,8 72,5 80,3",
  book: "0,16 8,15 16,17 24,13 32,14 40,10 48,11 56,8 64,6 72,7 80,4",
  srch: "0,15 8,17 16,13 24,14 32,10 40,12 48,8 56,9 64,6 72,4 80,5",
};

const METRICS = [
  { title: "Диалогов", value: "2 847", delta: 18, icon: MessagesSquare, spark: SPARKLINES.conv },
  { title: "Запросы на бронь", value: "156", delta: 12, icon: BookmarkCheck, spark: SPARKLINES.book },
  { title: "Поисков туров", value: "1 234", delta: 0, icon: Search, spark: SPARKLINES.srch },
  { title: "Ср. время ответа", value: "1.2с", delta: -8, icon: Clock, spark: null },
];

const FUNNEL = [
  { label: "Все диалоги", value: 2847, color: C },
  { label: "Вовлечённые", value: 1923, color: "#1A4FFF" },
  { label: "С поиском туров", value: 1456, color: "#3B82F6" },
  { label: "С результатами", value: 1089, color: "#60A5FA" },
  { label: "Запросы на бронь", value: 156, color: "#10B981" },
  { label: "Потенц. лиды", value: 89, color: "#93C5FD" },
];

const CONVOS = [
  { text: "Хочу тур в Турцию на двоих, всё включено", msgs: 12, searches: 3, dot: "#10B981" },
  { text: "Подскажите горящие туры в Египет", msgs: 8, searches: 2, dot: "#F59E0B" },
  { text: "Сколько стоит перелёт в Дубай?", msgs: 5, searches: 1, dot: "#F59E0B" },
  { text: "Есть ли туры в Мальдивы в марте?", msgs: 15, searches: 4, dot: "#10B981" },
  { text: "Можно узнать про визу в Таиланд?", msgs: 3, searches: 0, dot: "#CBD5E1" },
];

const INSIGHTS_O = [
  { text: "51% клиентов ищут туры через ассистента", color: C },
  { text: "38% запросов завершились показом предложений", color: C },
  { text: "5.5% клиентов проявляют интерес к бронированию", color: "#10B981" },
  { text: "Самое популярное направление: Турция (412 поисков)", color: C },
  { text: "Среднее время ответа ассистента: 1.2с", color: C },
  { text: "23% обращений поступают вне рабочего времени", color: C },
];

const AREA = "M0,55 C14,52 28,45 42,42 C56,39 70,35 84,30 C98,25 112,28 126,22 C140,16 154,18 168,14 C182,10 196,12 210,8 C224,5 238,6 252,3 L252,70 L0,70 Z";
const LINE = "M0,55 C14,52 28,45 42,42 C56,39 70,35 84,30 C98,25 112,28 126,22 C140,16 154,18 168,14 C182,10 196,12 210,8 C224,5 238,6 252,3";

/* ═══════ ANALYTICS DATA ═══════ */

const SEM = ["#0038FF","#F59E0B","#10B981","#EF4444","#8B5CF6"];

const COUNTRIES = [
  { name: "Турция", count: 412, pct: 100 },
  { name: "Египет", count: 287, pct: 70 },
  { name: "ОАЭ", count: 198, pct: 48 },
  { name: "Таиланд", count: 156, pct: 38 },
  { name: "Мальдивы", count: 89, pct: 22 },
];

const DEPS = [
  { name: "Москва", count: 534, pct: 100 },
  { name: "Санкт-Петербург", count: 312, pct: 58 },
  { name: "Казань", count: 145, pct: 27 },
  { name: "Екатеринбург", count: 98, pct: 18 },
];

const HEAT = [
  [0,0,0,1,2,3,4,4,3,2,1,0],
  [0,0,0,1,3,4,4,4,4,3,1,0],
  [0,0,0,2,3,4,3,4,4,3,2,0],
  [0,0,0,1,3,4,4,3,3,2,1,0],
  [0,0,0,2,3,4,4,4,3,2,1,0],
  [0,0,1,1,2,2,2,2,2,1,0,0],
  [0,0,0,1,1,1,1,1,1,0,0,0],
];
const HC = ["#F1F5F9","#DBEAFE","#93C5FD","#3B82F6","#0038FF"];
const DAYS = ["Пн","Вт","Ср","Чт","Пт","Сб","Вс"];
const HRS = ["0","2","4","6","8","10","12","14","16","18","20","22"];

const SM = [[12,45,8,3],[23,89,34,12],[56,234,67,23],[34,156,45,18]];
const SL = ["3★","4★","5★","4-5★"];
const ML = ["BB","HB","FB","AI"];

const QI = [
  "Турция лидирует с 33% всех поисков",
  "Пик активности: 10:00–14:00 по МСК",
  "78% клиентов ищут 5★ отели",
  "All Inclusive — самый популярный тип питания",
];

/* ═══════ HELPERS ═══════ */

function Card({ icon: Icon, title, s, children }: { icon: typeof Globe; title: string; s: number; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-white" style={{ padding: `${6*s}px ${7*s}px`, boxShadow: "0 1px 2px rgba(0,56,255,0.04)" }}>
      <div className="flex items-center gap-1" style={{ marginBottom: 4*s }}>
        <div className="flex items-center justify-center rounded-md bg-[#F0F4FF]" style={{ width: 12*s, height: 12*s }}>
          <Icon size={7*s} className="text-[#0038FF]" strokeWidth={1.8} />
        </div>
        <span className="font-semibold text-[#1E293B]" style={{ fontSize: 8*s }}>{title}</span>
      </div>
      {children}
    </div>
  );
}

/* ═══════ SCREENS ═══════ */

function Overview({ s }: { s: number }) {
  return (
    <div style={{ fontSize: 10*s }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 8*s }}>
        <div>
          <div className="font-bold text-[#1E293B]" style={{ fontSize: 12*s }}>Добрый день, Администратор</div>
          <div className="text-[#64748B]" style={{ fontSize: 8.5*s, marginTop: 1 }}>Вот что происходит с вашим AI-ассистентом</div>
        </div>
        <Period s={s} />
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" style={{ marginBottom: 8*s }}>
        {METRICS.map(m => {
          const I = m.icon;
          return (
            <div key={m.title} className="rounded-xl bg-white" style={{ padding: `${6*s}px ${7*s}px`, borderLeft: `2px solid rgba(0,56,255,0.4)`, boxShadow: "0 1px 2px rgba(0,56,255,0.04)" }}>
              <div className="flex items-center justify-between">
                <span className="font-medium text-[#64748B]" style={{ fontSize: 7.5*s }}>{m.title}</span>
                <div className="flex items-center justify-center rounded-md bg-[#F0F4FF]" style={{ width: 14*s, height: 14*s }}>
                  <I size={8*s} className="text-[#0038FF]" strokeWidth={1.8} />
                </div>
              </div>
              <div className="flex items-end justify-between" style={{ marginTop: 3*s }}>
                <div className="flex items-end gap-1">
                  <span className="font-bold text-[#1E293B] whitespace-nowrap" style={{ fontSize: 14*s }}>{m.value}</span>
                  {m.delta !== 0 && <span className={`flex items-center gap-0.5 rounded-full px-1 font-semibold ${m.delta>0?"bg-[#ECFDF5] text-[#10B981]":"bg-[#FEF2F2] text-[#EF4444]"}`} style={{ fontSize: 6*s, paddingBlock: 1 }}>
                    {m.delta>0?<TrendingUp size={6*s}/>:<TrendingDown size={6*s}/>}{m.delta>0?"+":""}{m.delta}%
                  </span>}
                </div>
                {m.spark && <svg width={40*s} height={14*s} viewBox="0 0 80 20" className="opacity-50"><polyline points={m.spark} fill="none" stroke={C} strokeWidth="1.5"/></svg>}
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[2fr_1fr]" style={{ marginBottom: 8*s }}>
        <div className="rounded-xl bg-white" style={{ padding: `${6*s}px ${7*s}px`, boxShadow: "0 1px 2px rgba(0,56,255,0.04)" }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 4*s }}>
            <span className="font-semibold text-[#1E293B]" style={{ fontSize: 8*s }}>Динамика</span>
            <div className="flex rounded-md bg-[#F1F5F9] p-0.5">
              {["Диалоги","Бронь","Поиски"].map((t,i)=><span key={t} className={`rounded-md px-1 py-0.5 font-medium ${i===0?"bg-[#0038FF] text-white shadow-sm":"text-[#64748B]"}`} style={{ fontSize: 6*s }}>{t}</span>)}
            </div>
          </div>
          <svg viewBox="0 0 252 70" className="w-full" style={{ height: 75*s }}>
            <defs><linearGradient id="og" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C} stopOpacity="0.12"/><stop offset="100%" stopColor={C} stopOpacity="0"/></linearGradient></defs>
            {[18,35,52].map(y=><line key={y} x1="0" y1={y} x2="252" y2={y} stroke="#E2E8F0" strokeDasharray="3 3"/>)}
            <path d={AREA} fill="url(#og)"/><path d={LINE} fill="none" stroke={C} strokeWidth="1.8"/>
            {["18 фев","22 фев","26 фев","2 мар"].map((l,i)=><text key={l} x={i*84} y="70" fill="#94A3B8" fontSize="5">{l}</text>)}
          </svg>
        </div>
        <div className="rounded-xl bg-white" style={{ padding: `${6*s}px ${7*s}px`, boxShadow: "0 1px 2px rgba(0,56,255,0.04)" }}>
          <span className="font-semibold text-[#1E293B] block" style={{ fontSize: 8*s, marginBottom: 4*s }}>Воронка конверсии</span>
          <div className="space-y-1">
            {FUNNEL.map(f=>{const p=(f.value/FUNNEL[0].value)*100;return(
              <div key={f.label}><div className="flex items-center justify-between"><span className="font-medium text-[#1E293B]" style={{ fontSize: 6*s }}>{f.label}</span><span className="font-semibold text-[#1E293B]" style={{ fontSize: 6.5*s }}>{f.value.toLocaleString("ru-RU")}</span></div>
              <div className="rounded-full bg-[#F1F5F9] overflow-hidden" style={{ height: 3*s }}><div className="h-full rounded-full" style={{ width:`${Math.max(p,3)}%`, backgroundColor: f.color }}/></div></div>
            );})}
          </div>
        </div>
      </div>

      <div className="rounded-xl bg-white" style={{ padding: `${6*s}px ${7*s}px`, boxShadow: "0 1px 2px rgba(0,56,255,0.04)", marginBottom: 6*s }}>
        <div className="flex items-center gap-1" style={{ marginBottom: 3*s }}>
          <div className="flex items-center justify-center rounded-md bg-[#FFFBEB]" style={{ width: 12*s, height: 12*s }}><Zap size={7*s} className="text-[#F59E0B]"/></div>
          <span className="font-semibold text-[#1E293B]" style={{ fontSize: 8*s }}>Быстрые инсайты</span>
        </div>
        <div className="grid grid-cols-1 gap-x-3 gap-y-0.5 sm:grid-cols-2">
          {INSIGHTS_O.map((ins,i)=><div key={i} className="flex items-start gap-1"><TrendingUp size={6*s} style={{ color: ins.color, marginTop: 1 }} className="shrink-0"/><span className="text-[#64748B]" style={{ fontSize: 6.5*s }}>{ins.text}</span></div>)}
        </div>
      </div>

      <div className="rounded-xl bg-white overflow-hidden" style={{ boxShadow: "0 1px 2px rgba(0,56,255,0.04)" }}>
        <div className="flex items-center justify-between" style={{ padding: `${5*s}px ${7*s}px` }}>
          <span className="font-semibold text-[#1E293B]" style={{ fontSize: 8*s }}>Последние диалоги</span>
          <span className="font-medium text-[#0038FF]" style={{ fontSize: 7*s }}>Все диалоги →</span>
        </div>
        <div className="border-t border-[#E2E8F0]/50">
          {CONVOS.map((c,i)=>(
            <div key={i} className="flex items-center gap-1.5 border-b border-[#E2E8F0]/30 last:border-0" style={{ padding: `${3*s}px ${7*s}px` }}>
              <span className="rounded-full shrink-0" style={{ width: 4*s, height: 4*s, backgroundColor: c.dot }}/>
              <span className="flex-1 text-[#1E293B] truncate" style={{ fontSize: 7*s }}>{c.text}</span>
              <div className="flex items-center gap-2 shrink-0">
                <span className="flex items-center gap-0.5 text-[#94A3B8]" style={{ fontSize: 6*s }}><MessageSquare size={6*s}/>{c.msgs}</span>
                <span className="flex items-center gap-0.5 text-[#94A3B8]" style={{ fontSize: 6*s }}><Search size={6*s}/>{c.searches}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Analytics({ s }: { s: number }) {
  return (
    <div style={{ fontSize: 10*s }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 6*s }}>
        <div>
          <div className="font-bold text-[#1E293B]" style={{ fontSize: 12*s }}>Аналитика</div>
          <div className="text-[#64748B]" style={{ fontSize: 8.5*s, marginTop: 1 }}>Детальный анализ поисковых запросов и поведения клиентов</div>
        </div>
        <Period s={s} />
      </div>

      <div className="grid grid-cols-2 gap-2" style={{ marginBottom: 8*s }}>
        <Card icon={Globe} title="Популярные направления" s={s}>
          <div className="space-y-1">
            {COUNTRIES.map((c,i)=>(
              <div key={c.name}><div className="flex items-center justify-between"><span className="font-medium text-[#1E293B]" style={{ fontSize: 7*s }}>{c.name}</span><span className="font-semibold text-[#1E293B]" style={{ fontSize: 7*s }}>{c.count}</span></div>
              <div className="rounded-full bg-[#F1F5F9] overflow-hidden" style={{ height: 3*s }}><div className="h-full rounded-full transition-all" style={{ width: `${c.pct}%`, backgroundColor: SEM[i] }}/></div></div>
            ))}
          </div>
        </Card>
        <Card icon={MapPin} title="Города вылета" s={s}>
          <div className="space-y-1">
            {DEPS.map((d,i)=>(
              <div key={d.name}><div className="flex items-center justify-between"><span className="font-medium text-[#1E293B]" style={{ fontSize: 7*s }}>{d.name}</span><span className="font-semibold text-[#1E293B]" style={{ fontSize: 7*s }}>{d.count}</span></div>
              <div className="rounded-full bg-[#F1F5F9] overflow-hidden" style={{ height: 3*s }}><div className="h-full rounded-full" style={{ width: `${d.pct}%`, backgroundColor: SEM[i] }}/></div></div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-2" style={{ marginBottom: 8*s }}>
        <Card icon={Calendar} title="Активность по часам" s={s}>
          <div>
            <div className="flex" style={{ marginLeft: 14*s, marginBottom: 1 }}>
              {HRS.map(h=><div key={h} className="flex-1 text-center text-[#94A3B8]" style={{ fontSize: 5*s }}>{h}</div>)}
            </div>
            {HEAT.map((row,ri)=>(
              <div key={ri} className="flex items-center gap-0.5">
                <span className="text-[#94A3B8] shrink-0 text-right" style={{ fontSize: 5.5*s, width: 12*s }}>{DAYS[ri]}</span>
                <div className="flex flex-1 gap-px">
                  {row.map((v,ci)=><div key={ci} className="flex-1 rounded-sm" style={{ height: 6*s, backgroundColor: HC[v] }}/>)}
                </div>
              </div>
            ))}
            <div className="flex items-center justify-end gap-0.5 mt-1">
              <span className="text-[#94A3B8]" style={{ fontSize: 5*s }}>Мин</span>
              {HC.map(c=><div key={c} className="rounded-sm" style={{ width: 6*s, height: 6*s, backgroundColor: c }}/>)}
              <span className="text-[#94A3B8]" style={{ fontSize: 5*s }}>Макс</span>
            </div>
          </div>
        </Card>
        <Card icon={Users} title="Звёздность × Питание" s={s}>
          <div>
            <div className="flex" style={{ marginLeft: 18*s, marginBottom: 2 }}>
              {ML.map(m=><div key={m} className="flex-1 text-center font-medium text-[#64748B]" style={{ fontSize: 6*s }}>{m}</div>)}
            </div>
            {SM.map((row,ri)=>(
              <div key={ri} className="flex items-center gap-0.5" style={{ marginBottom: 1 }}>
                <span className="text-[#64748B] shrink-0 font-medium text-right" style={{ fontSize: 6*s, width: 16*s }}>{SL[ri]}</span>
                <div className="flex flex-1 gap-0.5">
                  {row.map((v,ci)=>{const o=Math.max(0.08,v/234);return(
                    <div key={ci} className="flex-1 rounded-md flex items-center justify-center font-semibold" style={{ height: 14*s, backgroundColor: `rgba(0,56,255,${o})`, color: o>0.4?"white":o>0.15?"#0038FF":"#94A3B8", fontSize: 6.5*s }}>{v}</div>
                  );})}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="rounded-xl bg-white flex items-start gap-2" style={{ padding: `${5*s}px ${7*s}px`, boxShadow: "0 1px 2px rgba(0,56,255,0.04)" }}>
        <div className="flex items-center justify-center rounded-md bg-[#FFFBEB] shrink-0" style={{ width: 12*s, height: 12*s }}><Zap size={7*s} className="text-[#F59E0B]"/></div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 flex-1">
          {QI.map((t,i)=><div key={i} className="flex items-start gap-1"><TrendingUp size={6*s} className="text-[#0038FF] shrink-0" style={{ marginTop: 1 }}/><span className="text-[#64748B]" style={{ fontSize: 6.5*s }}>{t}</span></div>)}
        </div>
      </div>
    </div>
  );
}

function Period({ s }: { s: number }) {
  return (
    <div className="flex rounded-lg bg-white p-0.5" style={{ boxShadow: "0 1px 2px rgba(0,56,255,0.04)" }}>
      {["7 дн","30 дн","90 дн"].map((p,i)=>(
        <div key={p} className={`rounded-md px-1.5 py-0.5 font-medium ${i===1?"bg-[#0038FF] text-white":"text-[#64748B]"}`} style={{ fontSize: 7*s }}>{p}</div>
      ))}
    </div>
  );
}

/* ═══════ MAIN COMPONENT ═══════ */

export default function DashboardPreview({ initialScreen = "overview" }: { initialScreen?: Screen }) {
  const [screen, setScreen] = useState<Screen>(initialScreen);
  const s = 1;

  return (
    <div className="overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-lg">
      <div className="flex items-center gap-2 border-b border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-2">
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#FF5F57]"/>
          <span className="h-2.5 w-2.5 rounded-full bg-[#FFBD2E]"/>
          <span className="h-2.5 w-2.5 rounded-full bg-[#28C840]"/>
        </div>
        <div className="ml-2 flex-1 rounded-md bg-white px-3 py-1 text-[10px] text-[#64748B]">dashboard.navilet.ru</div>
      </div>

      <div className="flex" style={{ minHeight: 440 }}>
        <div className="flex flex-col border-r border-[#E2E8F0] bg-white/95 backdrop-blur-sm shrink-0" style={{ width: 52 }}>
          <div className="flex items-center justify-center border-b border-[#E2E8F0]" style={{ height: 42 }}>
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#0038FF] to-[#3B82F6] flex items-center justify-center">
              <span className="text-[10px] font-bold text-white">N</span>
            </div>
          </div>
          <div className="flex flex-1 flex-col items-center gap-0.5 py-2" style={{ paddingInline: 6 }}>
            {NAV.map(item => {
              const active = (screen === "overview" && item.id === "overview") || (screen === "analytics" && item.id === "analytics");
              const click = item.id === "overview" || item.id === "analytics";
              const Icon = item.icon;
              return (
                <div key={item.id} className="relative w-full">
                  {active && <div className="absolute left-0 top-1/2 -translate-y-1/2 rounded-r-full bg-[#0038FF]" style={{ width: 2.5, height: 16 }}/>}
                  <button
                    onClick={click ? () => setScreen(item.id as Screen) : undefined}
                    className={`flex items-center justify-center rounded-xl transition-colors w-full ${active?"bg-[#F0F4FF] text-[#0038FF]":"text-[#94A3B8]"} ${click?"cursor-pointer hover:text-[#0038FF]/70":"cursor-default"}`}
                    style={{ height: 34 }}
                    title={item.label}
                  >
                    <Icon size={16} strokeWidth={1.8}/>
                  </button>
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-center border-t border-[#E2E8F0] py-2.5">
            <div className="w-[26px] h-[26px] rounded-full bg-gradient-to-br from-[#0038FF] to-[#3B82F6] flex items-center justify-center">
              <span className="text-[9px] font-semibold text-white">A</span>
            </div>
          </div>
        </div>

        <div className="flex flex-1 flex-col min-w-0">
          <div className="flex items-center justify-between border-b border-[#E2E8F0] bg-white/80 backdrop-blur-sm px-3" style={{ height: 36 }}>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-[#1E293B]" style={{ fontSize: 11 }}>{screen === "overview" ? "Обзор" : "Аналитика"}</span>
              <div className="flex rounded-md bg-[#F1F5F9] p-0.5">
                {(["overview","analytics"] as Screen[]).map(sc=>(
                  <button key={sc} onClick={()=>setScreen(sc)} className={`rounded-md px-1.5 py-0.5 font-medium transition-colors ${screen===sc?"bg-[#0038FF] text-white shadow-sm":"text-[#64748B] hover:text-[#1E293B]"}`} style={{ fontSize: 7 }}>{sc==="overview"?"Обзор":"Аналитика"}</button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-1 text-[#94A3B8]" style={{ fontSize: 8 }}><Clock size={8}/><span>Только что</span></div>
              <div className="flex items-center gap-1 rounded-lg bg-[#F1F5F9] px-2" style={{ height: 20, fontSize: 8 }}>
                <Search size={9} className="text-[#94A3B8]"/><span className="text-[#94A3B8]">Поиск</span>
                <span className="hidden sm:inline rounded border border-[#E2E8F0] bg-white px-0.5 text-[#94A3B8] font-mono ml-0.5" style={{ fontSize: 6 }}>⌘K</span>
              </div>
              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[#0038FF] to-[#3B82F6] flex items-center justify-center">
                <span className="text-[8px] font-semibold text-white">A</span>
              </div>
            </div>
          </div>
          <div className="flex-1 overflow-hidden bg-[#F8FAFC]" style={{ padding: 10 }}>
            {screen === "overview" ? <Overview s={s} /> : <Analytics s={s} />}
          </div>
        </div>
      </div>
    </div>
  );
}
