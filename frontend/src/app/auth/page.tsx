"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { useAuth } from "@/hooks/useAuth";
import { CheckCircle, Loader2 } from "lucide-react";

type AuthView = "login" | "register" | "recovery" | "success";

export default function AuthPage() {
  const [view, setView] = useState<AuthView>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { signIn, signUp } = useAuth();
  const router = useRouter();

  function tr(msg: string): string {
    const map: Record<string, string> = {
      "Invalid login credentials": "Неверный email или пароль",
      "email rate limit exceeded": "Слишком много попыток. Подождите пару минут.",
      "User already registered": "Этот email уже зарегистрирован. Попробуйте войти.",
      "Email not confirmed": "Email не подтверждён. Проверьте почту.",
    };
    for (const [k, v] of Object.entries(map)) {
      if (msg.toLowerCase().includes(k.toLowerCase())) return v;
    }
    return msg;
  }

  const handleLogin = async () => {
    setError("");
    if (!email || !password) {
      setError("Заполните все поля");
      return;
    }
    setSubmitting(true);
    const err = await signIn(email, password);
    setSubmitting(false);
    if (err) {
      setError(tr(err));
      return;
    }
    router.push("/");
  };

  const handleRegister = async () => {
    setError("");
    if (!name || !email || !password || !confirmPassword) {
      setError("Заполните все поля");
      return;
    }
    if (password.length < 6) {
      setError("Пароль должен быть не менее 6 символов");
      return;
    }
    if (password !== confirmPassword) {
      setError("Пароли не совпадают");
      return;
    }
    if (!agreed) {
      setError("Примите пользовательское соглашение");
      return;
    }
    setSubmitting(true);
    const err = await signUp(email, password, name);
    setSubmitting(false);
    if (err) {
      if (err.toLowerCase().includes("already registered")) {
        setError("Этот email уже зарегистрирован.");
        setView("login");
      } else {
        setError(tr(err));
      }
      return;
    }
    setView("success");
  };

  const resetForm = () => {
    setName("");
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setError("");
    setAgreed(false);
  };

  if (view === "success") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-full max-w-md p-8 text-center">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Успешно!</h2>
          <p className="text-muted-foreground mb-6">
            Аккаунт создан. Добро пожаловать!
          </p>
          <Button
            onClick={() => router.push("/")}
            className="w-full bg-foreground text-background hover:bg-foreground/90"
          >
            Перейти к чату
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-6">
            <BrandLogo className="h-11" priority />
          </div>
          <h1 className="text-2xl font-bold">
            {view === "login" && "Войти"}
            {view === "register" && "Регистрация"}
            {view === "recovery" && "Восстановление пароля"}
          </h1>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        <div className="space-y-4">
          {view === "register" && (
            <div>
              <label className="text-sm font-medium mb-1.5 block">Имя</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Введите имя"
              />
            </div>
          )}

          <div>
            <label className="text-sm font-medium mb-1.5 block">Email</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@example.com"
            />
          </div>

          {view !== "recovery" && (
            <div>
              <label className="text-sm font-medium mb-1.5 block">Пароль</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Введите пароль"
              />
            </div>
          )}

          {view === "register" && (
            <div>
              <label className="text-sm font-medium mb-1.5 block">
                Подтвердите пароль
              </label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Повторите пароль"
              />
            </div>
          )}

          {view === "register" && (
            <label className="flex items-start gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-0.5 rounded border-border"
              />
              <span className="text-muted-foreground">
                Я согласен с{" "}
                <span className="text-brand underline">пользовательским соглашением</span>
                {" "}и{" "}
                <span className="text-brand underline">политикой конфиденциальности</span>
              </span>
            </label>
          )}

          <Button
            onClick={
              view === "login"
                ? handleLogin
                : view === "register"
                  ? handleRegister
                  : () => {}
            }
            disabled={submitting}
            className="w-full bg-foreground text-background hover:bg-foreground/90"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : view === "login" ? (
              "Войти"
            ) : view === "register" ? (
              "Зарегистрироваться"
            ) : (
              "Отправить ссылку"
            )}
          </Button>
        </div>

        <div className="mt-6 text-center text-sm text-muted-foreground space-y-2">
          {view === "login" && (
            <>
              <button
                onClick={() => { resetForm(); setView("recovery"); }}
                className="text-brand hover:underline block mx-auto"
              >
                Забыли пароль?
              </button>
              <p>
                Нет аккаунта?{" "}
                <button
                  onClick={() => { resetForm(); setView("register"); }}
                  className="text-brand hover:underline"
                >
                  Зарегистрироваться
                </button>
              </p>
            </>
          )}
          {view === "register" && (
            <p>
              Уже есть аккаунт?{" "}
              <button
                onClick={() => { resetForm(); setView("login"); }}
                className="text-brand hover:underline"
              >
                Войти
              </button>
            </p>
          )}
          {view === "recovery" && (
            <button
              onClick={() => { resetForm(); setView("login"); }}
              className="text-brand hover:underline"
            >
              Вернуться ко входу
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
