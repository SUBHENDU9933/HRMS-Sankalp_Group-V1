import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { LOGO } from "@/lib/utils-app";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2, Sparkles, ShieldCheck, MapPinned } from "lucide-react";

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
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center p-4">
      {/* Animated gradient background */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(135deg, #4DA3FF 0%, #7CB9FF 25%, #FFA94D 75%, #F97316 100%)",
        }}
      />
      {/* Color blobs */}
      <div className="absolute top-[-15%] left-[-10%] w-[500px] h-[500px] rounded-full bg-[#FFA94D] opacity-40 blur-3xl animate-pulse" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-[#4DA3FF] opacity-50 blur-3xl" />
      <div className="absolute top-1/3 right-1/4 w-[300px] h-[300px] rounded-full bg-fuchsia-400 opacity-30 blur-3xl" />
      {/* Subtle grid overlay */}
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)",
          backgroundSize: "44px 44px",
        }}
      />

      <div className="relative z-10 w-full max-w-5xl grid md:grid-cols-2 gap-6 items-center">
        {/* Left brand panel */}
        <div className="text-white px-2 md:px-6 hidden md:block">
          <div className="inline-flex items-center gap-3 bg-white/15 backdrop-blur-md border border-white/30 rounded-full px-4 py-2 mb-7 shadow-lg">
            <div className="w-7 h-7 rounded-md bg-slate-900 grid place-items-center overflow-hidden">
              <img src={LOGO} alt="" className="w-full h-full object-contain" />
            </div>
            <span className="font-heading font-bold tracking-tight">Sankalp Interior Solution</span>
          </div>
          <h1 className="font-heading text-5xl xl:text-6xl font-extrabold leading-[1.05] drop-shadow-md">
            Run your team
            <br />
            in <span className="text-[#FFE9D2]">colour</span>.
          </h1>
          <p className="font-bangla text-3xl mt-5 text-white/95 drop-shadow">
            ঘর নয়, স্বপ্ন সাজাই আমরা
          </p>
          <p className="mt-4 max-w-md text-white/90">
            Attendance, payroll, ledger and field-visit verification — all in one delightful workspace.
          </p>

          <div className="mt-8 flex flex-wrap gap-2">
            <Pill icon={ShieldCheck} text="JWT secured" />
            <Pill icon={MapPinned} text="GPS verified visits" />
            <Pill icon={Sparkles} text="Auto payroll + payslip" />
          </div>
        </div>

        {/* Right form card */}
        <form
          onSubmit={submit}
          className="w-full max-w-sm justify-self-center md:justify-self-end bg-white/95 backdrop-blur-xl rounded-2xl p-7 md:p-8 shadow-[0_25px_60px_-15px_rgba(15,23,42,0.35)] ring-1 ring-white/40"
          data-testid="login-form"
        >
          {/* Mobile logo */}
          <div className="flex md:hidden items-center gap-3 mb-5">
            <div className="w-11 h-11 rounded-xl bg-slate-900 grid place-items-center overflow-hidden ring-2 ring-[#FFA94D]/30">
              <img src={LOGO} alt="" className="w-full h-full object-contain" />
            </div>
            <div>
              <div className="font-heading font-extrabold text-slate-900">Sankalp</div>
              <div className="text-xs text-slate-500 -mt-0.5">Interior Solution</div>
            </div>
          </div>

          <div className="inline-flex items-center gap-2 mb-3">
            <span className="w-2 h-2 rounded-full bg-[#FFA94D] animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-[#FFA94D]">Welcome back</span>
          </div>
          <h2 className="font-heading text-3xl font-extrabold text-slate-900 leading-tight">
            Sign in to your <span className="bg-gradient-to-r from-[#4DA3FF] to-[#FFA94D] bg-clip-text text-transparent">workspace</span>
          </h2>
          <p className="text-sm text-slate-500 mt-1.5">Use your work email and password.</p>

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
              className="relative w-full overflow-hidden rounded-xl px-4 py-3 font-bold text-white shadow-lg active:scale-[0.98] transition-all disabled:opacity-60"
              style={{
                background:
                  "linear-gradient(135deg, #4DA3FF 0%, #6366F1 50%, #FFA94D 100%)",
                backgroundSize: "200% 200%",
                animation: busy ? undefined : "gradientShift 4s ease infinite",
              }}
              data-testid="login-submit-button"
            >
              <span className="relative z-10 flex items-center justify-center gap-2">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {busy ? "Signing in…" : "Sign in"}
              </span>
            </button>
          </div>

          <div className="mt-6 text-[11px] text-slate-400 text-center">
            © Sankalp Group & Business Solution
          </div>
        </form>
      </div>

      <style>{`
        @keyframes gradientShift {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
      `}</style>
    </div>
  );
}

const Pill = ({ icon: Icon, text }) => (
  <span className="inline-flex items-center gap-1.5 bg-white/20 backdrop-blur-md border border-white/30 text-white text-xs font-semibold px-3 py-1.5 rounded-full">
    <Icon className="w-3.5 h-3.5" /> {text}
  </span>
);
