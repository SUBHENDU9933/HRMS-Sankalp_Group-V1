import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { LOGO } from "@/lib/utils-app";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2 } from "lucide-react";

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await login(email.trim().toLowerCase(), password);
      toast.success("Welcome back");
      nav("/");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Login failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen grid md:grid-cols-2 bg-[#F7FAFC]">
      {/* Visual */}
      <div className="relative hidden md:block bg-slate-900 overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1703867110051-a0eb1e77b967?crop=entropy&cs=srgb&fm=jpg&q=85&w=1400"
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-60"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(135deg, rgba(77,163,255,0.65) 0%, rgba(255,169,77,0.55) 100%)",
            mixBlendMode: "multiply",
          }}
        />
        <div className="relative z-10 h-full flex flex-col justify-between p-12 text-white">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-slate-900 grid place-items-center overflow-hidden ring-2 ring-white/20">
              <img src={LOGO} alt="" className="w-full h-full object-contain" />
            </div>
            <div>
              <div className="font-heading font-extrabold text-xl leading-tight">Sankalp</div>
              <div className="text-xs opacity-90">Interior Solution</div>
            </div>
          </div>
          <div>
            <div className="font-bangla text-3xl md:text-4xl font-bold leading-tight max-w-md drop-shadow">
              ঘর নয়, স্বপ্ন সাজাই আমরা
            </div>
            <div className="mt-3 text-sm opacity-90 max-w-md">
              A trusted daily-use HRMS for our field, design, and admin teams. Track attendance, log site visits, and manage payroll — all in one place.
            </div>
          </div>
          <div className="text-xs opacity-80">© Sankalp Group & Business Solution</div>
        </div>
      </div>

      {/* Form */}
      <div className="flex items-center justify-center p-6">
        <form
          onSubmit={submit}
          className="w-full max-w-sm sk-card p-7 sk-page"
          data-testid="login-form"
        >
          <div className="flex md:hidden items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-lg bg-slate-900 grid place-items-center overflow-hidden">
              <img src={LOGO} alt="" className="w-full h-full object-contain" />
            </div>
            <div>
              <div className="font-heading font-extrabold">Sankalp</div>
              <div className="text-xs text-slate-500 -mt-0.5">Interior Solution</div>
            </div>
          </div>

          <h1 className="font-heading text-2xl font-extrabold text-slate-900">Sign in</h1>
          <p className="text-sm text-slate-500 mt-1">Welcome back. Please log in to continue.</p>

          <div className="mt-6 space-y-4">
            <div>
              <label className="sk-label">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="sk-input"
                placeholder="you@company.com"
                data-testid="login-email"
              />
            </div>
            <div>
              <label className="sk-label">Password</label>
              <div className="relative">
                <input
                  type={show ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="sk-input pr-10"
                  placeholder="••••••••"
                  data-testid="login-password"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShow((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600"
                >
                  {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              disabled={busy}
              className="sk-btn-primary w-full mt-1"
              data-testid="login-submit-button"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </div>

          <div className="mt-6 text-[11px] text-slate-400 text-center">
            Sankalp Group & Business Solution
          </div>
        </form>
      </div>
    </div>
  );
}
