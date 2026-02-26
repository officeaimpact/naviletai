"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { ChatMessage, ChatSession } from "@/lib/types";
import { sendMessage } from "@/lib/api";

const STORAGE_KEY = "navylet_sessions";
const MAX_SESSIONS = 50;

function generateId() {
  return crypto.randomUUID();
}

function extractTitle(message: string): string {
  const trimmed = message.trim();
  if (trimmed.length <= 40) return trimmed;
  return trimmed.slice(0, 37) + "...";
}

function loadSessions(): ChatSession[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveSessions(sessions: ChatSession[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(sessions.slice(0, MAX_SESSIONS))
    );
  } catch {
    // localStorage full — silently ignore
  }
}

export function useChat() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const stored = loadSessions();
    setSessions(stored);
  }, []);

  const persistSessions = useCallback((updated: ChatSession[]) => {
    setSessions(updated);
    saveSessions(updated);
  }, []);

  const persistCurrentMessages = useCallback(
    (sessionId: string, msgs: ChatMessage[], allSessions: ChatSession[]) => {
      const updated = allSessions.map((s) =>
        s.id === sessionId
          ? { ...s, messages: msgs, lastMessage: msgs[msgs.length - 1]?.content.slice(0, 60) || s.lastMessage, timestamp: Date.now() }
          : s
      );
      persistSessions(updated);
      return updated;
    },
    [persistSessions]
  );

  const send = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading) return;

      setError(null);

      const userMsg: ChatMessage = {
        id: generateId(),
        role: "user",
        content: text.trim(),
        timestamp: Date.now(),
      };

      const newMessages = [...messages, userMsg];
      setMessages(newMessages);
      setIsLoading(true);

      try {
        const response = await sendMessage(text.trim(), conversationId || undefined);
        let currentSessionId = activeSessionId;
        let currentSessions = sessions;

        if (!conversationId) {
          const newId = response.conversation_id;
          setConversationId(newId);
          currentSessionId = newId;
          setActiveSessionId(newId);

          const newSession: ChatSession = {
            id: newId,
            title: extractTitle(text),
            lastMessage: response.reply.slice(0, 60),
            timestamp: Date.now(),
            messages: [],
          };
          currentSessions = [newSession, ...sessions];
        }

        const assistantMsg: ChatMessage = {
          id: generateId(),
          role: "assistant",
          content: response.reply,
          tour_cards: response.tour_cards.length > 0 ? response.tour_cards : undefined,
          timestamp: Date.now(),
        };

        const finalMessages = [...newMessages, assistantMsg];
        setMessages(finalMessages);

        if (currentSessionId) {
          persistCurrentMessages(currentSessionId, finalMessages, currentSessions);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Произошла ошибка";
        setError(errorMessage);

        const errorMsg: ChatMessage = {
          id: generateId(),
          role: "assistant",
          content: "Извините, произошла техническая ошибка. Попробуйте ещё раз.",
          timestamp: Date.now(),
        };

        const finalMessages = [...newMessages, errorMsg];
        setMessages(finalMessages);

        if (activeSessionId) {
          persistCurrentMessages(activeSessionId, finalMessages, sessions);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [conversationId, isLoading, messages, activeSessionId, sessions, persistCurrentMessages]
  );

  const newChat = useCallback(() => {
    setMessages([]);
    setConversationId(null);
    setActiveSessionId(null);
    setError(null);
  }, []);

  const selectSession = useCallback(
    (id: string) => {
      const session = sessions.find((s) => s.id === id);
      setActiveSessionId(id);
      setConversationId(id);
      setMessages(session?.messages || []);
      setError(null);
    },
    [sessions]
  );

  const deleteSession = useCallback(
    (id: string) => {
      const updated = sessions.filter((s) => s.id !== id);
      persistSessions(updated);
      if (activeSessionId === id) {
        setMessages([]);
        setConversationId(null);
        setActiveSessionId(null);
      }
    },
    [sessions, activeSessionId, persistSessions]
  );

  return {
    messages,
    isLoading,
    error,
    sessions,
    activeSessionId,
    conversationId,
    send,
    newChat,
    selectSession,
    deleteSession,
  };
}
