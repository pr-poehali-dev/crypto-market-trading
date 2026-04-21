import { useState } from "react";
import Icon from "@/components/ui/icon";
import { api, User } from "@/lib/api";

interface Props {
  onAuth: (user: User, token: string) => void;
}

export default function AuthPage({ onAuth }: Props) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPass, setShowPass] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      let res;
      if (mode === "login") {
        res = await api.login(email, password);
      } else {
        res = await api.register(email, password, name);
      }
      if (res.error) {
        setError(res.error);
      } else if (res.token && res.user) {
        localStorage.setItem("cx_token", res.token);
        onAuth(res.user, res.token);
      }
    } catch {
      setError("Ошибка соединения. Попробуйте позже.");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "#08090f" }}>
      {/* Background grid */}
      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage: "linear-gradient(rgba(34,197,94,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(34,197,94,0.03) 1px, transparent 1px)",
        backgroundSize: "50px 50px"
      }} />
      {/* Glow */}
      <div className="fixed top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(34,197,94,0.06) 0%, transparent 70%)" }} />

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center font-black text-xl text-black"
            style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)", boxShadow: "0 0 30px rgba(34,197,94,0.3)" }}>
            CX
          </div>
          <h1 className="text-2xl font-black text-white">CryptoX</h1>
          <p className="text-sm text-[#6b7280] mt-1">Крипто-биржа нового поколения</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl p-6 space-y-5"
          style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.08)" }}>

          {/* Tabs */}
          <div className="grid grid-cols-2 gap-1 p-1 rounded-xl" style={{ background: "#070a0f" }}>
            {(["login", "register"] as const).map(m => (
              <button key={m} onClick={() => { setMode(m); setError(""); }}
                className="py-2 rounded-lg text-sm font-semibold transition-all"
                style={mode === m
                  ? { background: "#22c55e", color: "#000" }
                  : { color: "#6b7280" }}>
                {m === "login" ? "Войти" : "Регистрация"}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="space-y-3">
            {mode === "register" && (
              <div>
                <label className="text-[10px] text-[#6b7280] uppercase tracking-wider mb-1.5 block">Ваше имя</label>
                <input
                  value={name} onChange={e => setName(e.target.value)}
                  placeholder="Иван Петров"
                  className="w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none transition-colors"
                  style={{ background: "#070a0f", border: "1px solid rgba(255,255,255,0.08)", color: "#e8eaf0" }}
                  required
                />
              </div>
            )}
            <div>
              <label className="text-[10px] text-[#6b7280] uppercase tracking-wider mb-1.5 block">Email</label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none transition-colors"
                style={{ background: "#070a0f", border: "1px solid rgba(255,255,255,0.08)", color: "#e8eaf0" }}
                required
              />
            </div>
            <div>
              <label className="text-[10px] text-[#6b7280] uppercase tracking-wider mb-1.5 block">Пароль</label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  value={password} onChange={e => setPassword(e.target.value)}
                  placeholder={mode === "register" ? "Минимум 6 символов" : "Ваш пароль"}
                  className="w-full rounded-lg px-3 py-2.5 pr-10 text-sm focus:outline-none transition-colors"
                  style={{ background: "#070a0f", border: "1px solid rgba(255,255,255,0.08)", color: "#e8eaf0" }}
                  required minLength={6}
                />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6b7280] hover:text-[#e8eaf0]">
                  <Icon name={showPass ? "EyeOff" : "Eye"} size={15} />
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg text-sm"
                style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444" }}>
                <Icon name="AlertCircle" size={15} />
                {error}
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full py-3 rounded-xl font-bold text-sm text-black transition-all hover:opacity-90 disabled:opacity-50 mt-2"
              style={{ background: "#22c55e", boxShadow: "0 0 20px rgba(34,197,94,0.25)" }}>
              {loading ? "Подождите..." : mode === "login" ? "Войти в аккаунт" : "Создать аккаунт"}
            </button>
          </form>

          {/* OAuth */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }} />
            </div>
            <div className="relative text-center">
              <span className="px-3 text-xs text-[#6b7280]" style={{ background: "#0d1117" }}>или войти через</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setError("Google: добавьте Client ID в настройках проекта")}
              className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all hover:bg-white/5"
              style={{ border: "1px solid rgba(255,255,255,0.08)", color: "#e8eaf0" }}>
              <span className="text-base">G</span>
              Google
            </button>
            <button
              onClick={() => setError("VK: добавьте App ID в настройках проекта")}
              className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all hover:bg-white/5"
              style={{ border: "1px solid rgba(255,255,255,0.08)", color: "#e8eaf0" }}>
              <span className="text-base">VK</span>
              ВКонтакте
            </button>
          </div>
        </div>

        {/* Security note */}
        <div className="mt-4 flex items-center justify-center gap-2 text-xs text-[#6b7280]">
          <Icon name="Shield" size={13} />
          Ваши данные защищены шифрованием
        </div>
      </div>
    </div>
  );
}
