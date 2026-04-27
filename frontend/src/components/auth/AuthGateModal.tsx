"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";

interface AuthGateModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const ERROR_MAP: Record<string, string> = {
  "Invalid login credentials": "Неверный email или пароль",
  "Email not confirmed": "Email не подтверждён. Проверьте почту.",
  "User already registered": "Этот email уже зарегистрирован. Попробуйте войти.",
  "email rate limit exceeded":
    "Слишком много попыток. Подождите пару минут и попробуйте снова.",
  "over_email_send_rate_limit": "Слишком много попыток. Подождите пару минут.",
  "For security purposes, you can only request this after":
    "Подождите немного перед повторной попыткой.",
  "Password should be at least 6 characters":
    "Пароль должен быть не менее 6 символов",
  "Unable to validate email address: invalid format": "Неверный формат email",
  "Signup requires a valid password": "Введите пароль",
  "custom provider custom": "Провайдер пока не настроен в Supabase Dashboard.",
  "Unsupported provider": "Провайдер пока не настроен в Supabase Dashboard.",
};

function translateError(msg: string): string {
  for (const [key, val] of Object.entries(ERROR_MAP)) {
    if (msg.toLowerCase().includes(key.toLowerCase())) return val;
  }
  return msg;
}

function YandexIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M13.32 21h2.16V3h-3.36c-3.6 0-5.52 1.92-5.52 4.68 0 2.16 1.08 3.48 3.12 4.92L6.72 21h2.28l3.36-9.12c-2.16-1.44-3-2.52-3-4.44 0-1.8 1.2-3 3.24-3h.72V21z" />
    </svg>
  );
}

function TelegramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  );
}

const SOCIAL_PROVIDERS = [
  {
    id: "custom:yandex",
    label: "Яндекс",
    icon: YandexIcon,
    bg: "bg-[#FC3F1D]",
    hover: "hover:bg-[#E03618]",
    iconClass: "h-5 w-5",
  },
  {
    id: "custom:telegram",
    label: "Telegram",
    icon: TelegramIcon,
    bg: "bg-[#2AABEE]",
    hover: "hover:bg-[#229ED9]",
    iconClass: "h-5 w-5",
  },
] as const;

export function AuthGateModal({
  open,
  onClose,
  onSuccess,
}: AuthGateModalProps) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [socialLoading, setSocialLoading] = useState<string | null>(null);
  const { signIn, signUp, signInWithProvider, user } = useAuth();

  useEffect(() => {
    if (open) {
      setMode("login");
      setName("");
      setEmail("");
      setPassword("");
      setShowPassword(false);
      setError("");
      setInfo("");
      setSubmitting(false);
      setSocialLoading(null);
    }
  }, [open]);

  useEffect(() => {
    if (open && user) {
      onSuccess();
    }
  }, [user, open, onSuccess]);

  const handleSocial = async (providerId: string) => {
    setError("");
    setSocialLoading(providerId);
    try {
      await signInWithProvider(providerId);
    } catch {
      setError(translateError(`Unsupported provider: ${providerId}`));
      setSocialLoading(null);
    }
  };

  const handleSubmit = async () => {
    setError("");
    setInfo("");
    if (!email || !password) {
      setError("Заполните все поля");
      return;
    }
    if (mode === "register" && !name) {
      setError("Введите имя");
      return;
    }
    if (password.length < 6) {
      setError("Пароль — минимум 6 символов");
      return;
    }

    setSubmitting(true);

    if (mode === "register") {
      const result = await signUp(email, password, name);
      setSubmitting(false);
      if (result) {
        if (result.includes("Проверьте почту")) {
          setInfo(result);
        } else if (
          result.toLowerCase().includes("already registered") ||
          result.toLowerCase().includes("already been registered")
        ) {
          setError("Этот email уже зарегистрирован.");
          setMode("login");
        } else {
          setError(translateError(result));
        }
      }
    } else {
      const result = await signIn(email, password);
      setSubmitting(false);
      if (result) {
        setError(translateError(result));
      }
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <div className="absolute inset-0 bg-black/40" onClick={onClose} />
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 12 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 12 }}
            transition={{ type: "spring", damping: 28, stiffness: 350 }}
            onClick={(e) => e.stopPropagation()}
            className="relative bg-background rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
          >
            <button
              onClick={onClose}
              className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-muted transition-colors z-10"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>

            <div className="p-6 pt-8">
              {/* Header */}
              <div className="text-center mb-5">
                <h2 className="text-lg font-bold">
                  {mode === "login" ? "Войти в аккаунт" : "Создать аккаунт"}
                </h2>
                <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                  {mode === "login"
                    ? "Войдите, чтобы сохранять чаты и избранное"
                    : "Зарегистрируйтесь — это бесплатно и займёт 30 секунд"}
                </p>
              </div>

              {/* Error */}
              {error && (
                <div className="bg-red-50 text-red-600 text-xs p-2.5 rounded-lg mb-3 text-center">
                  {error}
                </div>
              )}

              {/* Info */}
              {info && (
                <div className="bg-blue-50 text-blue-600 text-xs p-2.5 rounded-lg mb-3 text-center">
                  {info}
                </div>
              )}

              {/* Social buttons */}
              <div className="space-y-2">
                {SOCIAL_PROVIDERS.map(({ id, label, icon: Icon, bg, hover, iconClass }) => (
                  <button
                    key={id}
                    onClick={() => handleSocial(id)}
                    disabled={!!socialLoading}
                    className={`w-full flex items-center justify-center gap-2.5 h-10 rounded-lg
                                ${bg} ${hover} text-white text-sm font-medium
                                active:scale-[0.98] transition-all disabled:opacity-50`}
                  >
                    {socialLoading === id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Icon className={iconClass} />
                        Войти через {label}
                      </>
                    )}
                  </button>
                ))}
              </div>

              {/* Divider */}
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border/50" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-background px-3 text-[11px] text-muted-foreground">
                    или по email
                  </span>
                </div>
              </div>

              {/* Email form */}
              <div className="space-y-3">
                {mode === "register" && (
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ваше имя"
                    className="h-11 text-sm"
                    autoComplete="name"
                  />
                )}
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email"
                  className="h-11 text-sm"
                  autoComplete="email"
                />
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Пароль"
                    className="h-11 text-sm pr-10"
                    autoComplete={
                      mode === "register" ? "new-password" : "current-password"
                    }
                    onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>

                <Button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="w-full bg-brand hover:bg-brand/90 text-white h-11 text-sm font-medium"
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : mode === "register" ? (
                    "Создать аккаунт"
                  ) : (
                    "Войти"
                  )}
                </Button>

                <p className="text-center text-xs text-muted-foreground pt-1">
                  {mode === "register" ? (
                    <>
                      Уже есть аккаунт?{" "}
                      <button
                        onClick={() => {
                          setMode("login");
                          setError("");
                          setInfo("");
                        }}
                        className="text-brand font-medium hover:underline"
                      >
                        Войти
                      </button>
                    </>
                  ) : (
                    <>
                      Нет аккаунта?{" "}
                      <button
                        onClick={() => {
                          setMode("register");
                          setError("");
                          setInfo("");
                        }}
                        className="text-brand font-medium hover:underline"
                      >
                        Зарегистрироваться
                      </button>
                    </>
                  )}
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
