"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

import {
  Menu,
  Plus,
  Heart,
  Info,
  Bot,
  LogOut,
  User,
  ChevronRight,
  BookOpen,
} from "lucide-react";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { ChatSession } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

interface MobileNavProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  onNewChat: () => void;
  onSelectSession: (id: string) => void;
  onFavoritesClick: () => void;
  onMemosClick?: () => void;
  onAboutClick?: () => void;
  onPartnersClick?: () => void;
  onLogoClick: () => void;
  isFavoritesActive?: boolean;
  isMemosActive?: boolean;
  isAboutActive?: boolean;
  isPartnersActive?: boolean;
}

export function MobileNav({
  sessions,
  activeSessionId,
  onNewChat,
  onSelectSession,
  onFavoritesClick,
  onMemosClick,
  onAboutClick,
  onPartnersClick,
  onLogoClick,
  isFavoritesActive = false,
  isMemosActive = false,
  isAboutActive = false,
  isPartnersActive = false,
}: MobileNavProps) {
  return (
    <div className="md:hidden flex items-center justify-between px-4 py-3 border-b border-border bg-background">
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-72 p-0">
          <SheetTitle className="sr-only">Меню навигации</SheetTitle>
          <div className="flex flex-col h-full">
            {/* Logo */}
            <div className="p-4">
              <button
                onClick={onLogoClick}
                className="cursor-pointer transition-opacity hover:opacity-80"
                aria-label="На главную"
              >
                <BrandLogo className="h-8" priority />
              </button>
            </div>

            {/* Actions */}
            <div className="px-3 space-y-1">
              <Button
                onClick={onNewChat}
                className="w-full bg-foreground text-background hover:bg-foreground/90 justify-start gap-2"
              >
                <Plus className="h-4 w-4" />
                Новый чат
              </Button>
              <Button
                variant="ghost"
                className={cn(
                  "w-full justify-start gap-2",
                  isFavoritesActive
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground"
                )}
                onClick={onFavoritesClick}
              >
                <Heart className={cn("h-4 w-4", isFavoritesActive && "fill-red-500 text-red-500")} />
                Избранное
              </Button>
              <Button
                variant="ghost"
                className={cn(
                  "w-full justify-start gap-2",
                  isMemosActive
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground"
                )}
                onClick={onMemosClick}
              >
                <BookOpen className="h-4 w-4" />
                Памятки
              </Button>
              <Button
                variant="ghost"
                className={cn(
                  "w-full justify-start gap-2",
                  isAboutActive
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground"
                )}
                onClick={onAboutClick}
              >
                <Info className="h-4 w-4" />
                О нас
              </Button>
              <Button
                variant="ghost"
                className={cn(
                  "w-full justify-start gap-2",
                  isPartnersActive
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground"
                )}
                onClick={onPartnersClick}
              >
                <Bot className="h-4 w-4" />
                ИИ-ассистент
              </Button>
            </div>

            <Separator className="my-3" />

            <div className="px-4 mb-2">
              <span className="text-xs font-medium text-muted-foreground">
                История чатов
              </span>
            </div>

            <ScrollArea className="flex-1 px-2">
              {sessions.length === 0 && (
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
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:bg-muted/50"
                  )}
                >
                  {session.title}
                </button>
              ))}
            </ScrollArea>

            <div className="border-t border-border px-3 py-3 mt-auto">
              <p className="text-[10px] text-muted-foreground/40 text-center leading-tight">
                Поиск туров через TourVisor · 100+ туроператоров
              </p>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <button
        onClick={onLogoClick}
        className="cursor-pointer transition-opacity hover:opacity-80"
        aria-label="На главную"
      >
        <BrandLogo className="h-6" priority />
      </button>

      <Button
        variant="ghost"
        size="icon"
        onClick={onNewChat}
      >
        <Plus className="h-5 w-5" />
      </Button>
    </div>
  );
}

// Auth removed for B2B agent build. Helper kept here for easy rollback later.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function MobileNavFooter({ onAuthClick }: { onAuthClick?: () => void }) {
  const { user, signOut } = useAuth();
  const [showMenu, setShowMenu] = useState(false);

  const initials = user?.user_metadata?.name
    ? user.user_metadata.name.slice(0, 1).toUpperCase()
    : user?.email?.slice(0, 1).toUpperCase() || "";
  const displayName =
    user?.user_metadata?.name || user?.email?.split("@")[0] || "";

  return (
    <div className="border-t border-border">
      {user ? (
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="w-full px-3 py-3 flex items-center gap-2.5 hover:bg-muted/50 active:bg-muted transition-colors"
          >
            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-brand to-blue-400 flex items-center justify-center shrink-0">
              <span className="text-sm font-semibold text-white">{initials}</span>
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
            <ChevronRight
              className={cn(
                "h-4 w-4 text-muted-foreground shrink-0 transition-transform",
                showMenu && "rotate-90"
              )}
            />
          </button>

          {showMenu && (
            <div className="px-2 pb-2">
              <button
                onClick={() => {
                  signOut();
                  setShowMenu(false);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Выйти из аккаунта
              </button>
            </div>
          )}
        </div>
      ) : (
        <button
          onClick={onAuthClick}
          className="w-full px-3 py-3 flex items-center gap-2.5 hover:bg-muted/50 active:bg-muted transition-colors"
        >
          <div className="h-9 w-9 rounded-full border-2 border-dashed border-muted-foreground/30 flex items-center justify-center shrink-0">
            <User className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-sm font-medium text-foreground">Войти</p>
            <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
              Сохраняйте чаты и избранное
            </p>
          </div>
        </button>
      )}

      <div className="px-3 pb-2.5 pt-0.5">
        <p className="text-[10px] text-muted-foreground/40 text-center leading-tight">
          Поиск туров через TourVisor · 100+ туроператоров
        </p>
      </div>
    </div>
  );
}
