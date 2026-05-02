"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { motion, AnimatePresence } from "framer-motion";

import {
  Plus,
  Heart,
  Info,
  Handshake,
  PanelLeftClose,
  PanelLeft,
  MessageSquare,
  LogOut,
  User,
  Ellipsis,
} from "lucide-react";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { ChatSession } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

interface SidebarProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  onNewChat: () => void;
  onSelectSession: (id: string) => void;
  onFavoritesClick: () => void;
  onAboutClick?: () => void;
  onPartnersClick?: () => void;
  onLogoClick: () => void;
  onAuthClick?: () => void;
  isFavoritesActive?: boolean;
  isAboutActive?: boolean;
  isPartnersActive?: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function Sidebar({
  sessions,
  activeSessionId,
  onNewChat,
  onSelectSession,
  onFavoritesClick,
  onAboutClick,
  onPartnersClick,
  onLogoClick,
  onAuthClick,
  isFavoritesActive = false,
  isAboutActive = false,
  isPartnersActive = false,
  collapsed = false,
  onToggleCollapse,
}: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(collapsed);

  const handleToggle = () => {
    setIsCollapsed(!isCollapsed);
    onToggleCollapse?.();
  };

  return (
    <aside
      className={cn(
        "flex flex-col h-screen border-r border-sidebar-border bg-sidebar transition-all duration-300",
        isCollapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo & Collapse */}
      <div className="flex items-center justify-between p-4">
        {!isCollapsed && (
          <button
            onClick={onLogoClick}
            className="cursor-pointer transition-opacity hover:opacity-80"
            aria-label="На главную"
          >
            <BrandLogo className="h-8" priority />
          </button>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={handleToggle}
          className="h-8 w-8 shrink-0"
        >
          {isCollapsed ? (
            <PanelLeft className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* New Chat Button */}
      <div className="px-3 mb-1">
        <Button
          onClick={onNewChat}
          className="w-full bg-foreground text-background hover:bg-foreground/90 justify-start gap-2"
          size={isCollapsed ? "icon" : "default"}
        >
          <Plus className="h-4 w-4 shrink-0" />
          {!isCollapsed && <span>Новый чат</span>}
        </Button>
      </div>

      {/* Navigation */}
      <div className="px-3 space-y-0.5 mt-1">
        <Button
          variant="ghost"
          onClick={onFavoritesClick}
          className={cn(
            "w-full justify-start gap-2 hover:text-foreground",
            isFavoritesActive
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "text-muted-foreground"
          )}
          size={isCollapsed ? "icon" : "default"}
        >
          <Heart className={cn("h-4 w-4 shrink-0", isFavoritesActive && "fill-red-500 text-red-500")} />
          {!isCollapsed && <span>Избранное</span>}
        </Button>
        <Button
          variant="ghost"
          onClick={onAboutClick}
          className={cn(
            "w-full justify-start gap-2 hover:text-foreground",
            isAboutActive
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "text-muted-foreground"
          )}
          size={isCollapsed ? "icon" : "default"}
        >
          <Info className="h-4 w-4 shrink-0" />
          {!isCollapsed && <span>О нас</span>}
        </Button>
        <Button
          variant="ghost"
          onClick={onPartnersClick}
          className={cn(
            "w-full justify-start gap-2 hover:text-foreground",
            isPartnersActive
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "text-muted-foreground"
          )}
          size={isCollapsed ? "icon" : "default"}
        >
          <Handshake className="h-4 w-4 shrink-0" />
          {!isCollapsed && <span>Партнёрам</span>}
        </Button>
      </div>

      <Separator className="my-3" />

      {/* Chat History */}
      {!isCollapsed && (
        <div className="px-4 mb-2">
          <span className="text-xs font-medium text-muted-foreground">
            История чатов
          </span>
        </div>
      )}

      <ScrollArea className="flex-1 px-2">
        <div className="space-y-0.5">
          {sessions.length === 0 && !isCollapsed && (
            <p className="px-3 py-4 text-xs text-muted-foreground/50 text-center">
              Начните диалог, чтобы увидеть историю
            </p>
          )}
          {sessions.map((session) => (
            <button
              key={session.id}
              onClick={() => onSelectSession(session.id)}
              className={cn(
                "w-full text-left px-3 py-2 min-h-[44px] flex items-center rounded-lg text-sm truncate transition-colors",
                activeSessionId === session.id && !isFavoritesActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground"
              )}
            >
              {isCollapsed ? (
                <MessageSquare className="h-4 w-4" />
              ) : (
                <span className="truncate">{session.title}</span>
              )}
            </button>
          ))}
        </div>
      </ScrollArea>

      {/* Profile footer */}
      <SidebarFooter isCollapsed={isCollapsed} onAuthClick={onAuthClick} />
    </aside>
  );
}

function SidebarFooter({
  isCollapsed,
  onAuthClick,
}: {
  isCollapsed: boolean;
  onAuthClick?: () => void;
}) {
  const { user, signOut } = useAuth();
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const closeMenu = useCallback(() => setShowMenu(false), []);

  useEffect(() => {
    if (!showMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeMenu();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showMenu, closeMenu]);

  const initials = user?.user_metadata?.name
    ? user.user_metadata.name.slice(0, 1).toUpperCase()
    : user?.email?.slice(0, 1).toUpperCase() || "";
  const displayName =
    user?.user_metadata?.name || user?.email?.split("@")[0] || "";

  /* ── Collapsed state ── */
  if (isCollapsed) {
    return (
      <div className="border-t border-sidebar-border py-3 flex flex-col items-center gap-2 relative" ref={menuRef}>
        {user ? (
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="relative h-9 w-9 rounded-full bg-gradient-to-br from-brand to-blue-400 flex items-center justify-center hover:ring-2 hover:ring-brand/30 transition-all"
          >
            <span className="text-xs font-semibold text-white">{initials}</span>
          </button>
        ) : (
          <button
            onClick={onAuthClick}
            className="h-9 w-9 rounded-full border-2 border-dashed border-muted-foreground/30 flex items-center justify-center hover:border-brand hover:text-brand text-muted-foreground transition-colors"
          >
            <User className="h-4 w-4" />
          </button>
        )}

        <AnimatePresence>
          {showMenu && user && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="absolute bottom-full left-0 mb-1.5 w-52 rounded-xl border border-border bg-background shadow-xl p-1 z-50"
            >
              <div className="px-3 py-2.5 border-b border-border/50 mb-1">
                <p className="text-sm font-semibold truncate">{displayName}</p>
                {user.email && (
                  <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                    {user.email}
                  </p>
                )}
              </div>
              <button
                onClick={() => {
                  signOut();
                  closeMenu();
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Выйти из аккаунта
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  /* ── Expanded state ── */
  return (
    <div className="border-t border-sidebar-border relative" ref={menuRef}>
      {user ? (
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="w-full px-3 py-3 flex items-center gap-2.5 hover:bg-muted/50 transition-colors group"
        >
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-brand to-blue-400 flex items-center justify-center shrink-0">
            <span className="text-xs font-semibold text-white">{initials}</span>
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-sm font-medium truncate leading-tight">
              {displayName}
            </p>
            {user.email && (
              <p className="text-[11px] text-muted-foreground truncate leading-tight mt-0.5">
                {user.email}
              </p>
            )}
          </div>
          <Ellipsis className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
        </button>
      ) : (
        <button
          onClick={onAuthClick}
          className="w-full px-3 py-3 flex items-center gap-2.5 hover:bg-muted/50 transition-colors group"
        >
          <div className="h-8 w-8 rounded-full border-2 border-dashed border-muted-foreground/30 flex items-center justify-center shrink-0 group-hover:border-brand transition-colors">
            <User className="h-4 w-4 text-muted-foreground group-hover:text-brand transition-colors" />
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-sm font-medium text-foreground">Войти</p>
            <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
              Сохраняйте чаты и избранное
            </p>
          </div>
        </button>
      )}

      {/* Popover menu */}
      <AnimatePresence>
        {showMenu && user && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute bottom-full left-2 right-2 mb-1.5 rounded-xl border border-border bg-background shadow-xl p-1 z-50"
          >
            <div className="px-3 py-2.5 border-b border-border/50 mb-1">
              <p className="text-sm font-semibold truncate">{displayName}</p>
              {user.email && (
                <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                  {user.email}
                </p>
              )}
            </div>

            <button
              onClick={() => {
                signOut();
                closeMenu();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Выйти из аккаунта
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="px-3 pb-2.5 pt-0.5">
        <p className="text-[10px] text-muted-foreground/40 text-center leading-tight">
          Данные предоставлены «Магазин Горящих Путёвок»
        </p>
      </div>
    </div>
  );
}
