"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Menu, Plus, Heart, MessageSquare } from "lucide-react";
import { ChatSession } from "@/lib/types";
import { cn } from "@/lib/utils";

interface MobileNavProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  onNewChat: () => void;
  onSelectSession: (id: string) => void;
  onFavoritesClick: () => void;
  onLogoClick: () => void;
  isFavoritesActive?: boolean;
}

export function MobileNav({
  sessions,
  activeSessionId,
  onNewChat,
  onSelectSession,
  onFavoritesClick,
  onLogoClick,
  isFavoritesActive = false,
}: MobileNavProps) {
  const router = useRouter();

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
              <button onClick={onLogoClick} className="cursor-pointer hover:opacity-80 transition-opacity">
                <img src="/logo.svg" alt="навылет!" className="h-8" />
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
            </div>

            <Separator className="my-3" />

            <div className="px-4 mb-2">
              <span className="text-xs font-medium text-muted-foreground">
                История чатов
              </span>
            </div>

            <ScrollArea className="flex-1 px-2">
              {sessions.map((session) => (
                <button
                  key={session.id}
                  onClick={() => onSelectSession(session.id)}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-lg text-sm truncate transition-colors",
                    activeSessionId === session.id && !isFavoritesActive
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:bg-muted/50"
                  )}
                >
                  {session.title}
                </button>
              ))}
            </ScrollArea>

            <div className="p-3 border-t border-border">
              <button
                onClick={() => router.push("/profile")}
                className="flex items-center gap-3 w-full p-1 rounded-lg hover:bg-muted"
              >
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-brand text-white text-xs font-semibold">
                    E
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-medium truncate">Eva Mendes</p>
                  <p className="text-xs text-muted-foreground truncate">
                    eva@example.com
                  </p>
                </div>
              </button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <button onClick={onLogoClick} className="cursor-pointer hover:opacity-80 transition-opacity">
        <img src="/logo.svg" alt="навылет!" className="h-6" />
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
