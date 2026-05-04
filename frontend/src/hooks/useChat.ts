"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { ChatMessage, ChatSession } from "@/lib/types";
import {
  sendMessage,
  clearClientProfile as clearClientProfileApi,
  setClientProfile as setClientProfileApi,
} from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

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

function loadLocalSessions(): ChatSession[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalSessions(sessions: ChatSession[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions.slice(0, MAX_SESSIONS)));
  } catch {}
}

export function useChat() {
  const { user, supabase, loading: authLoading } = useAuth();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Профиль клиента: накапливается backend-ом из переписки, отображается чипом
  // над инпутом. null = чип скрыт. См. CopilotSession.client_profile в backend.
  const [clientProfile, setClientProfile] = useState<string | null>(null);
  const prevAuthKey = useRef<string | null>(null);
  const migratedForUser = useRef<string | null>(null);

  const isAuth = !!user && !!supabase;
  const authKey = isAuth ? user!.id : "anon";

  useEffect(() => {
    if (authLoading) return;
    if (prevAuthKey.current === authKey) return;
    prevAuthKey.current = authKey;

    if (isAuth) {
      supabase
        .from("chat_sessions")
        .select("id, title, last_message, updated_at")
        .order("updated_at", { ascending: false })
        .limit(MAX_SESSIONS)
        .then(({ data }) => {
          if (data) {
            setSessions(
              data.map((s: { id: string; title: string; last_message: string; updated_at: string }) => ({
                id: s.id,
                title: s.title,
                lastMessage: s.last_message || "",
                timestamp: new Date(s.updated_at).getTime(),
                messages: [],
              }))
            );
          }
        });
    } else {
      setSessions(loadLocalSessions());
    }
  }, [authKey, isAuth, supabase, authLoading]);

  useEffect(() => {
    if (!isAuth || !user) return;
    if (migratedForUser.current === user.id) return;
    migratedForUser.current = user.id;

    (async () => {
      // Migrate localStorage sessions
      const local = loadLocalSessions();
      for (const session of local) {
        await supabase.from("chat_sessions").upsert({
          id: session.id,
          user_id: user.id,
          title: session.title,
          last_message: session.lastMessage,
        });
        const msgs = (session.messages || []).map((m: ChatMessage) => ({
          session_id: session.id,
          user_id: user.id,
          role: m.role,
          content: m.content,
          tour_cards: m.tour_cards || null,
        }));
        if (msgs.length > 0) {
          await supabase.from("chat_messages").insert(msgs);
        }
      }
      if (local.length > 0) localStorage.removeItem(STORAGE_KEY);

      // Migrate current in-memory session (messages sent before login)
      if (conversationId && messages.length > 0) {
        const title = extractTitle(messages[0]?.content || "Чат");
        await supabase.from("chat_sessions").upsert({
          id: conversationId,
          user_id: user.id,
          title,
          last_message: messages[messages.length - 1]?.content.slice(0, 60) || "",
        });

        const existingMsgs = await supabase
          .from("chat_messages")
          .select("id")
          .eq("session_id", conversationId)
          .limit(1);

        if (!existingMsgs.data || existingMsgs.data.length === 0) {
          const rows = messages.map((m) => ({
            session_id: conversationId,
            user_id: user.id,
            role: m.role,
            content: m.content,
            tour_cards: m.tour_cards || null,
          }));
          await supabase.from("chat_messages").insert(rows);
        }
      }

      // Re-fetch sessions
      const { data } = await supabase
        .from("chat_sessions")
        .select("id, title, last_message, updated_at")
        .order("updated_at", { ascending: false })
        .limit(MAX_SESSIONS);
      if (data) {
        setSessions(
          data.map((s: { id: string; title: string; last_message: string; updated_at: string }) => ({
            id: s.id,
            title: s.title,
            lastMessage: s.last_message || "",
            timestamp: new Date(s.updated_at).getTime(),
            messages: [],
          }))
        );
      }
    })();
  }, [isAuth, supabase, user, conversationId, messages]);

  const persistCurrentMessages = useCallback(
    async (sessionId: string, msgs: ChatMessage[], allSessions: ChatSession[]) => {
      const updated = allSessions.map((s) =>
        s.id === sessionId
          ? { ...s, messages: msgs, lastMessage: msgs[msgs.length - 1]?.content.slice(0, 60) || s.lastMessage, timestamp: Date.now() }
          : s
      );
      setSessions(updated);
      if (!isAuth) saveLocalSessions(updated);

      if (isAuth) {
        await supabase.from("chat_sessions").upsert({
          id: sessionId,
          user_id: user!.id,
          title: updated.find((s) => s.id === sessionId)?.title || "Чат",
          last_message: msgs[msgs.length - 1]?.content.slice(0, 60) || "",
        });
      }
      return updated;
    },
    [isAuth, supabase, user]
  );

  const saveMessages = useCallback(
    async (sessionId: string, userMsg: ChatMessage, assistantMsg: ChatMessage) => {
      if (!isAuth) return;
      await supabase.from("chat_messages").insert([
        { session_id: sessionId, user_id: user!.id, role: userMsg.role, content: userMsg.content },
        { session_id: sessionId, user_id: user!.id, role: assistantMsg.role, content: assistantMsg.content, tour_cards: assistantMsg.tour_cards || null },
      ]);
    },
    [isAuth, supabase, user]
  );

  const send = useCallback(
    async (text: string, images?: string[]) => {
      const trimmed = text.trim();
      const hasImages = !!images && images.length > 0;
      if ((!trimmed && !hasImages) || isLoading) return;
      setError(null);

      const userContent = trimmed
        || (hasImages ? `[Прикреплено изображений: ${images!.length}]` : "");

      const userMsg: ChatMessage = {
        id: generateId(),
        role: "user",
        content: userContent,
        timestamp: Date.now(),
      };

      const newMessages = [...messages, userMsg];
      setMessages(newMessages);
      setIsLoading(true);

      try {
        const response = await sendMessage(
          trimmed,
          conversationId || undefined,
          hasImages ? images : undefined,
        );
        if (response.client_profile !== undefined) {
          setClientProfile(response.client_profile ?? null);
        }
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

        const responseCards = response.tour_cards ?? [];
        const cascadePhase =
          !!response.cascade_missing || response.turn_intent === "cascade_block";
        const assistantMsg: ChatMessage = {
          id: generateId(),
          role: "assistant",
          content: response.reply,
          tour_cards: responseCards.length > 0 ? responseCards : undefined,
          timestamp: Date.now(),
          cascade_missing: response.cascade_missing ?? null,
          slots: cascadePhase ? response.slots_collected ?? null : null,
          cascade_phase: cascadePhase,
        };

        const finalMessages = [...newMessages, assistantMsg];
        setMessages(finalMessages);

        if (currentSessionId) {
          await persistCurrentMessages(currentSessionId, finalMessages, currentSessions);
          await saveMessages(currentSessionId, userMsg, assistantMsg);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Произошла ошибка";
        setError(errorMessage);

        const errorMsg: ChatMessage = {
          id: generateId(),
          role: "assistant",
          content: "Что-то пошло не так — попробуйте повторить запрос ещё раз.",
          timestamp: Date.now(),
        };

        const finalMessages = [...newMessages, errorMsg];
        setMessages(finalMessages);

        if (activeSessionId) {
          await persistCurrentMessages(activeSessionId, finalMessages, sessions);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [conversationId, isLoading, messages, activeSessionId, sessions, persistCurrentMessages, saveMessages]
  );

  const newChat = useCallback(() => {
    setMessages([]);
    setConversationId(null);
    setActiveSessionId(null);
    setError(null);
    setClientProfile(null);
  }, []);

  const clearClientProfile = useCallback(async () => {
    if (!conversationId) {
      setClientProfile(null);
      return;
    }
    setClientProfile(null);
    try {
      await clearClientProfileApi(conversationId);
    } catch {
      // Игнорируем сетевую ошибку: чип уже скрыт локально, на следующем
      // ходу backend пере-выведет профиль из переписки если нужно.
    }
  }, [conversationId]);

  const updateClientProfile = useCallback(
    async (profile: string) => {
      if (!conversationId) return;
      const trimmed = profile.trim().slice(0, 200);
      setClientProfile(trimmed || null);
      try {
        await setClientProfileApi(conversationId, trimmed);
      } catch {}
    },
    [conversationId]
  );

  /**
   * Локально добавить пару user/assistant сообщений в текущий чат.
   * Не дёргает backend — нужно для UX-действий в HotelDetailPanel:
   * «Зафиксировать перелёт», «Собрать подборку», «Актуализировать цену».
   * Backend о таких действиях узнаёт уже из контекста следующего сообщения,
   * но визуально пара появляется мгновенно.
   */
  const appendLocal = useCallback(
    (
      userText: string,
      assistantText: string,
      assistantCards?: ChatMessage["tour_cards"]
    ) => {
      const userMsg: ChatMessage = {
        id: generateId(),
        role: "user",
        content: userText,
        timestamp: Date.now(),
      };
      const assistantMsg: ChatMessage = {
        id: generateId(),
        role: "assistant",
        content: assistantText,
        tour_cards: assistantCards && assistantCards.length > 0 ? assistantCards : undefined,
        timestamp: Date.now() + 1,
      };
      setMessages((prev) => [...prev, userMsg, assistantMsg]);
    },
    []
  );

  const selectSession = useCallback(
    async (id: string) => {
      setActiveSessionId(id);
      setConversationId(id);
      setError(null);
      // При переключении сессии чип сбрасывается; backend вернёт актуальный
      // профиль на следующем ходу (он живёт в SESSIONS[cid].client_profile).
      setClientProfile(null);

      if (isAuth) {
        const { data } = await supabase
          .from("chat_messages")
          .select("id, role, content, tour_cards, created_at")
          .eq("session_id", id)
          .order("created_at", { ascending: true });
        if (data) {
          setMessages(
            data.map((m: { id: string; role: string; content: string; tour_cards: unknown; created_at: string }) => ({
              id: m.id,
              role: m.role as "user" | "assistant",
              content: m.content,
              tour_cards: m.tour_cards as ChatMessage["tour_cards"],
              timestamp: new Date(m.created_at).getTime(),
            }))
          );
        }
      } else {
        const session = sessions.find((s) => s.id === id);
        setMessages(session?.messages || []);
      }
    },
    [isAuth, supabase, sessions]
  );

  const deleteSession = useCallback(
    async (id: string) => {
      if (isAuth) {
        await supabase.from("chat_sessions").delete().eq("id", id);
      }
      const updated = sessions.filter((s) => s.id !== id);
      setSessions(updated);
      if (!isAuth) saveLocalSessions(updated);
      if (activeSessionId === id) {
        setMessages([]);
        setConversationId(null);
        setActiveSessionId(null);
      }
    },
    [isAuth, supabase, sessions, activeSessionId]
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
    appendLocal,
    clientProfile,
    clearClientProfile,
    updateClientProfile,
  };
}
