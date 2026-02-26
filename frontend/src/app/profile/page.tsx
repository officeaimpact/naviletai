"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  ArrowLeft,
  Settings,
  User,
  Lock,
  MessageCircle,
  Globe,
  ChevronRight,
  Trash2,
  LogOut,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

type ProfileView =
  | "menu"
  | "general"
  | "account"
  | "edit"
  | "password"
  | "delete"
  | "contact";

export default function ProfilePage() {
  const [view, setView] = useState<ProfileView>("menu");
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [deletePassword, setDeletePassword] = useState("");

  const { user, logout, updateProfile } = useAuth();
  const router = useRouter();

  const goBack = () => {
    if (view === "menu") {
      router.push("/");
    } else if (view === "edit" || view === "password" || view === "delete") {
      setView("account");
    } else {
      setView("menu");
    }
  };

  const menuItems = [
    {
      icon: Settings,
      label: "Общие настройки",
      onClick: () => setView("general"),
    },
    {
      icon: User,
      label: "Настройки аккаунта",
      onClick: () => setView("account"),
    },
    {
      icon: MessageCircle,
      label: "Связаться",
      onClick: () => setView("contact"),
    },
  ];

  const accountItems = [
    {
      icon: User,
      label: "Редактировать профиль",
      onClick: () => {
        setNewName(user?.name || "");
        setNewEmail(user?.email || "");
        setView("edit");
      },
    },
    {
      icon: Lock,
      label: "Сменить пароль",
      onClick: () => setView("password"),
    },
    {
      icon: Trash2,
      label: "Удалить аккаунт",
      onClick: () => setView("delete"),
      danger: true,
    },
  ];

  const title: Record<ProfileView, string> = {
    menu: "Личный кабинет",
    general: "Общие настройки",
    account: "Настройки аккаунта",
    edit: "Редактировать профиль",
    password: "Сменить пароль",
    delete: "Удаление аккаунта",
    contact: "Связаться",
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-lg mx-auto p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Button variant="ghost" size="icon" onClick={goBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">{title[view]}</h1>
        </div>

        {/* Menu View */}
        {view === "menu" && (
          <div className="space-y-2">
            {/* User Card */}
            <div className="flex items-center gap-4 p-4 rounded-xl bg-muted mb-6">
              <Avatar className="h-14 w-14">
                <AvatarFallback className="bg-brand text-white text-lg font-semibold">
                  {user?.name?.[0]?.toUpperCase() || "?"}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold">{user?.name || "Гость"}</p>
                <p className="text-sm text-muted-foreground">
                  {user?.email || "Войдите в аккаунт"}
                </p>
              </div>
            </div>

            {menuItems.map((item) => (
              <button
                key={item.label}
                onClick={item.onClick}
                className="w-full flex items-center justify-between p-4 rounded-xl hover:bg-muted transition-colors"
              >
                <div className="flex items-center gap-3">
                  <item.icon className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm font-medium">{item.label}</span>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            ))}

            <Separator className="my-4" />

            <button
              onClick={() => {
                logout();
                router.push("/");
              }}
              className="w-full flex items-center gap-3 p-4 rounded-xl hover:bg-muted transition-colors text-red-500"
            >
              <LogOut className="h-5 w-5" />
              <span className="text-sm font-medium">Выйти</span>
            </button>
          </div>
        )}

        {/* General Settings */}
        {view === "general" && (
          <div className="space-y-4">
            <button className="w-full flex items-center justify-between p-4 rounded-xl hover:bg-muted transition-colors">
              <div className="flex items-center gap-3">
                <Globe className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm font-medium">Язык</span>
              </div>
              <span className="text-sm text-muted-foreground">Русский</span>
            </button>
          </div>
        )}

        {/* Account Settings */}
        {view === "account" && (
          <div className="space-y-2">
            {accountItems.map((item) => (
              <button
                key={item.label}
                onClick={item.onClick}
                className={cn(
                  "w-full flex items-center justify-between p-4 rounded-xl hover:bg-muted transition-colors",
                  item.danger && "text-red-500"
                )}
              >
                <div className="flex items-center gap-3">
                  <item.icon className="h-5 w-5" />
                  <span className="text-sm font-medium">{item.label}</span>
                </div>
                <ChevronRight className="h-4 w-4" />
              </button>
            ))}
          </div>
        )}

        {/* Edit Profile */}
        {view === "edit" && (
          <div className="space-y-4">
            <div className="flex justify-center mb-6">
              <Avatar className="h-20 w-20">
                <AvatarFallback className="bg-brand text-white text-2xl font-semibold">
                  {user?.name?.[0]?.toUpperCase() || "?"}
                </AvatarFallback>
              </Avatar>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Имя</label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Email</label>
              <Input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
              />
            </div>
            <Button
              className="w-full bg-foreground text-background hover:bg-foreground/90"
              onClick={() => {
                updateProfile({ name: newName, email: newEmail });
                setView("account");
              }}
            >
              Сохранить
            </Button>
          </div>
        )}

        {/* Change Password */}
        {view === "password" && (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">
                Текущий пароль
              </label>
              <Input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">
                Новый пароль
              </label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">
                Подтвердите пароль
              </label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            <Button
              className="w-full bg-foreground text-background hover:bg-foreground/90"
              onClick={() => setView("account")}
            >
              Сменить пароль
            </Button>
          </div>
        )}

        {/* Delete Account */}
        {view === "delete" && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-red-50 text-red-700 text-sm">
              Это действие необратимо. Все ваши данные, история чатов и избранное
              будут удалены.
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">
                Введите пароль для подтверждения
              </label>
              <Input
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
              />
            </div>
            <Button
              variant="destructive"
              className="w-full"
              onClick={() => {
                logout();
                router.push("/");
              }}
            >
              Удалить аккаунт
            </Button>
          </div>
        )}

        {/* Contact */}
        {view === "contact" && (
          <div className="space-y-3">
            <a
              href="mailto:support@navylet.ru"
              className="flex items-center gap-3 p-4 rounded-xl hover:bg-muted transition-colors"
            >
              <MessageCircle className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Email</p>
                <p className="text-xs text-muted-foreground">
                  support@navylet.ru
                </p>
              </div>
            </a>
            <a
              href="https://t.me/navylet"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-4 rounded-xl hover:bg-muted transition-colors"
            >
              <MessageCircle className="h-5 w-5 text-brand" />
              <div>
                <p className="text-sm font-medium">Telegram</p>
                <p className="text-xs text-muted-foreground">@navylet</p>
              </div>
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
