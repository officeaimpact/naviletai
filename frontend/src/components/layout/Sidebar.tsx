"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Plus,
  Heart,
  PanelLeftClose,
  PanelLeft,
  MessageSquare,
} from "lucide-react";
import { ChatSession } from "@/lib/types";
import { cn } from "@/lib/utils";

interface SidebarProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  onNewChat: () => void;
  onSelectSession: (id: string) => void;
  onFavoritesClick: () => void;
  onLogoClick: () => void;
  isFavoritesActive?: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function Sidebar({
  sessions,
  activeSessionId,
  onNewChat,
  onSelectSession,
  onFavoritesClick,
  onLogoClick,
  isFavoritesActive = false,
  collapsed = false,
  onToggleCollapse,
}: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(collapsed);
  const router = useRouter();

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
          <button onClick={onLogoClick} className="cursor-pointer hover:opacity-80 transition-opacity">
            <img src="/logo.svg" alt="навылет!" className="h-8" />
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

      {/* Favorites */}
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
          {sessions.map((session) => (
            <button
              key={session.id}
              onClick={() => onSelectSession(session.id)}
              className={cn(
                "w-full text-left px-3 py-2 rounded-lg text-sm truncate transition-colors",
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

      {/* User Avatar */}
      <div className="p-3 border-t border-sidebar-border">
        <button
          onClick={() => router.push("/profile")}
          className={cn(
            "flex items-center gap-3 w-full rounded-lg p-1 hover:bg-muted transition-colors",
            isCollapsed && "justify-center"
          )}
        >
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-brand text-white text-xs font-semibold">
              E
            </AvatarFallback>
          </Avatar>
          {!isCollapsed && (
            <div className="flex-1 min-w-0 text-left">
              <p className="text-sm font-medium truncate">Eva Mendes</p>
              <p className="text-xs text-muted-foreground truncate">
                eva@example.com
              </p>
            </div>
          )}
        </button>
      </div>
    </aside>
  );
}
