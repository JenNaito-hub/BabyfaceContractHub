"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const redirectTo = search.get("redirect") || "/talent";

  const [mode, setMode] = useState<"password" | "magic">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function signInPassword(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push(redirectTo);
    router.refresh();
  }

  async function signInMagic(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(
          redirectTo,
        )}`,
      },
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setInfo("Đã gửi link đăng nhập vào email. Kiểm tra hộp thư nhé.");
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-lime text-2xl font-extrabold text-dark">
          B
        </div>
        <h1 className="text-2xl font-extrabold">Babyface Talent Manager</h1>
        <p className="mt-1 text-sm text-dark/60">Đăng nhập để tiếp tục</p>
      </div>

      <div className="card">
        <div className="mb-4 flex rounded-lg bg-dark/5 p-1 text-sm font-semibold">
          <button
            className={`flex-1 rounded-md px-3 py-1.5 ${
              mode === "password" ? "bg-white shadow-sm" : "text-dark/50"
            }`}
            onClick={() => setMode("password")}
            type="button"
          >
            Mật khẩu
          </button>
          <button
            className={`flex-1 rounded-md px-3 py-1.5 ${
              mode === "magic" ? "bg-white shadow-sm" : "text-dark/50"
            }`}
            onClick={() => setMode("magic")}
            type="button"
          >
            Magic link
          </button>
        </div>

        <form onSubmit={mode === "password" ? signInPassword : signInMagic} className="space-y-4">
          <div>
            <label className="label">Email</label>
            <input
              type="email"
              required
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ban@babyface.vn"
            />
          </div>

          {mode === "password" && (
            <div>
              <label className="label">Mật khẩu</label>
              <input
                type="password"
                required
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
          )}

          {error && (
            <p className="rounded-lg bg-warning/10 px-3 py-2 text-sm text-warning">{error}</p>
          )}
          {info && (
            <p className="rounded-lg bg-lime/20 px-3 py-2 text-sm text-dark">{info}</p>
          )}

          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? "Đang xử lý…" : mode === "password" ? "Đăng nhập" : "Gửi magic link"}
          </button>
        </form>
      </div>

      <p className="mt-6 text-center text-xs text-dark/40">
        Tài khoản do quản trị viên tạo trong Supabase Auth.
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Suspense fallback={<div className="text-sm text-dark/50">Đang tải…</div>}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
