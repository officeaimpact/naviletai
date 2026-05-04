"use client";

import { InputBar } from "./InputBar";
import { motion } from "framer-motion";
import { PoweredByNavilet } from "@/components/brand/PoweredByNavilet";
import {
  Compass,
  ClipboardList,
  Flame,
  GitCompare,
  Gift,
  MessageSquare,
  type LucideIcon,
} from "lucide-react";

interface ActionCard {
  icon: LucideIcon;
  title: string;
  hint: string;
  prompt: string;
}

// Главные сценарии работы агента в платформе. Кнопки — НЕ примеры запроса клиента,
// а функциональные CTA: ассистент сам поведёт по шагам и спросит, что ему нужно.
// Принцип: одно нажатие = понятная задача, без необходимости «уметь промптить».
const ACTIONS: ActionCard[] = [
  {
    icon: Compass,
    title: "Подобрать тур клиенту",
    hint: "Соберу параметры по одному вопросу за раз",
    prompt:
      "Помоги подобрать тур клиенту. Задавай по одному уточняющему вопросу — соберём направление, вылет, даты, состав, категорию, питание и бюджет, а потом запустим поиск.",
  },
  {
    icon: ClipboardList,
    title: "Разобрать переписку",
    hint: "Вставлю чат — соберёшь короткое ТЗ",
    prompt:
      "Я сейчас вставлю переписку с клиентом. Собери из неё короткое ТЗ по шаблону: клиент / направление / даты / важно / бюджет. Поиск не запускай — только выжимка, потом я проверю и решу, что искать.",
  },
  {
    icon: Flame,
    title: "Горящие туры",
    hint: "Что есть прямо сейчас по городу вылета",
    prompt:
      "Покажи горящие туры. Спроси у меня город вылета и при необходимости направление, остальные параметры подбери из доступных предложений.",
  },
  {
    icon: GitCompare,
    title: "Сравнить отели или туры",
    hint: "Пляж, питание, цена/качество, кому подходит",
    prompt:
      "Хочу сравнить туры или отели. Объясни, что от меня нужно: позиции из текущей выдачи (1, 2, 3) или названия отелей. Если выдачи ещё нет — спроси параметры и собери её. По каким критериям ты сравниваешь и в каком формате будет ответ?",
  },
  {
    icon: Gift,
    title: "Собрать подборку клиенту",
    hint: "Выберу варианты — соберём ссылку для отправки",
    prompt:
      "Хочу собрать подборку для клиента. Расскажи, как тебе указать нужные туры из выдачи (по номерам или названиям), что войдёт в ссылку, и как клиент её увидит. Если выдачи ещё нет — давай сначала найдём туры.",
  },
  {
    icon: MessageSquare,
    title: "Написать сообщение клиенту",
    hint: "Готовый текст для WhatsApp или Telegram",
    prompt:
      "Помоги написать клиенту сообщение по найденным турам — короткий черновик для WhatsApp или Telegram, без аббревиатур и кодов. Если выдачи ещё нет, скажи, что тебе нужно.",
  },
];

interface WelcomeScreenProps {
  onSend: (message: string, images?: string[]) => void;
  isLoading?: boolean;
}

export function WelcomeScreen({ onSend, isLoading }: WelcomeScreenProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="text-center mb-8"
      >
        <p className="text-base md:text-lg font-medium text-muted-foreground mb-2">
          Я ваш AI-помощник по работе с клиентами
        </p>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight leading-snug">
          С чего начнём?
        </h1>
        <p className="text-sm text-muted-foreground mt-3 max-w-xl mx-auto">
          Соберу ТЗ, подниму туры в TourVisor, сравню варианты и подготовлю подборку для отправки клиенту.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15, ease: "easeOut" }}
        className="w-full max-w-2xl mb-8"
      >
        <InputBar
          onSend={onSend}
          isLoading={isLoading}
          centered
          placeholder="Опишите запрос клиента или нажмите действие ниже…"
        />
      </motion.div>

      <div className="w-full max-w-3xl">
        <p className="mb-3 text-center text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Что умеет ассистент
        </p>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {ACTIONS.map((a, i) => {
            const Icon = a.icon;
            return (
              <motion.button
                key={a.title}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.25 + i * 0.05, ease: "easeOut" }}
                onClick={() => onSend(a.prompt)}
                disabled={isLoading}
                className="group flex items-start gap-3 rounded-2xl border border-border bg-white p-3.5 text-left
                           hover:border-brand/40 hover:bg-brand/[0.03] hover:-translate-y-0.5 hover:shadow-sm
                           active:scale-[0.98] transition-all duration-150
                           disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
              >
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl
                             bg-brand/10 text-brand transition-colors
                             group-hover:bg-brand group-hover:text-white"
                >
                  <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold text-foreground leading-tight">
                    {a.title}
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground leading-snug">
                    {a.hint}
                  </span>
                </span>
              </motion.button>
            );
          })}
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.6 }}
        className="mt-8"
      >
        <PoweredByNavilet />
      </motion.div>
    </div>
  );
}
