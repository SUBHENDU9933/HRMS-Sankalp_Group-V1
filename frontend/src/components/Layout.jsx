import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { LOGO } from "@/lib/utils-app";
import {
  LayoutDashboard, MapPinned, ClipboardCheck, Users, Wallet, BookOpen,
  UserCircle, LogOut, Menu, Plus, Settings as SettingsIcon
} from "lucide-react";
import { useState } from "react";

const ALL_ITEMS = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, roles: ["admin","manager","employee"], end: true },
  { to: "/visits", label: "Field Visits", icon: MapPinned, roles: ["admin","manager","employee"] },
  { to: "/attendance", label: "Attendance", icon: ClipboardCheck, roles: ["admin","manager","employee"] },
  { to: "/employees", label: "Employees", icon: Users, roles: ["admin","manager"] },
  { to: "/payroll", label: "Payroll", icon: Wallet, roles: ["admin","manager","employee"] },
  { to: "/ledger", label: "Ledger", icon: BookOpen, roles: ["admin","manager","employee"] },
  { to: "/settings", label: "Settings", icon: SettingsIcon, roles: ["admin"] },
  { to: "/profile", label: "Profile", icon: UserCircle, roles: ["admin","manager","employee"] },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [mobileMenu, setMobileMenu] = useState(false);

  const items = ALL_ITEMS.filter(i => i.roles.includes(user.role));
  // Mobile bottom nav: 4 + center FAB + more
  const mobileBottomItems = items.filter(i =>
    ["/", "/visits", "/attendance", "/payroll"].includes(i.to)
  );

  const handleLogout = () => { logout(); nav("/login"); };

  return (
    <div className="min-h-screen bg-[#F7FAFC]">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 w-64 bg-white border-r border-slate-200 flex-col z-30">
        <div className="px-5 py-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-900 grid place-items-center overflow-hidden shrink-0">
              <img src={LOGO} alt="Sankalp" className="w-full h-full object-contain" />
            </div>
            <div className="leading-tight">
              <div className="font-heading font-extrabold text-slate-900 text-[15px]">Sankalp</div>
              <div className="text-[11px] text-slate-500 -mt-0.5">Interior Solution</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto" data-testid="sidebar-nav">
          {items.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              data-testid={`nav-${label.toLowerCase().replace(/\s+/g, "-")}`}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? "bg-[#4DA3FF] text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100"
                }`
              }
            >
              <Icon className="w-4 h-4 shrink-0" strokeWidth={2.2} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-slate-100 p-3">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="w-9 h-9 rounded-full bg-[#1E3A8A] grid place-items-center text-white font-bold text-sm border-2 border-[#F97316]">
              {user?.name?.[0]?.toUpperCase() || "U"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-slate-900 truncate">{user?.name}</div>
              <div className="text-xs text-slate-500 capitalize">{user?.role}</div>
            </div>
            <button
              data-testid="logout-button"
              onClick={handleLogout}
              className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-red-500 transition"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden sticky top-0 z-30 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-md bg-slate-900 grid place-items-center overflow-hidden">
            <img src={LOGO} alt="" className="w-full h-full object-contain" />
          </div>
          <div className="font-heading font-extrabold text-slate-900 text-base">Sankalp</div>
        </div>
        <button
          onClick={() => setMobileMenu(true)}
          data-testid="mobile-menu-button"
          className="p-2 rounded-lg text-slate-700 hover:bg-slate-100"
        >
          <Menu className="w-5 h-5" />
        </button>
      </header>

      {/* Mobile drawer */}
      {mobileMenu && (
        <div className="md:hidden fixed inset-0 z-50 bg-black/50" onClick={() => setMobileMenu(false)}>
          <div className="absolute right-0 top-0 bottom-0 w-72 bg-white p-4 animate-in slide-in-from-right duration-200" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="font-heading font-bold">Menu</div>
              <button onClick={() => setMobileMenu(false)} className="text-slate-500 text-sm">Close</button>
            </div>
            <div className="space-y-1">
              {items.map(({ to, label, icon: Icon, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  onClick={() => setMobileMenu(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                      isActive ? "bg-[#4DA3FF] text-white" : "text-slate-700 hover:bg-slate-100"
                    }`
                  }
                >
                  <Icon className="w-4 h-4" /> {label}
                </NavLink>
              ))}
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 mt-2"
              >
                <LogOut className="w-4 h-4" /> Logout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="md:pl-64 pb-24 md:pb-8 min-h-screen">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-5 md:py-8">
          <Outlet />
        </div>
      </main>

      {/* Mobile bottom nav with FAB */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-slate-200 sk-bottom-nav">
        <div className="grid grid-cols-5 items-end">
          {mobileBottomItems.slice(0, 2).map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              data-testid={`bottom-nav-${label.toLowerCase().replace(/\s+/g, "-")}`}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center py-2.5 text-[10px] font-semibold transition ${
                  isActive ? "text-[#4DA3FF]" : "text-slate-500"
                }`
              }
            >
              <Icon className="w-5 h-5 mb-0.5" />
              {label}
            </NavLink>
          ))}
          <NavLink
            to="/visits/new"
            data-testid="bottom-nav-new-visit"
            className="flex items-center justify-center -mt-5"
          >
            <span className="w-14 h-14 rounded-full bg-[#FFA94D] hover:bg-[#F97316] text-white grid place-items-center shadow-lg active:scale-95 transition">
              <Plus className="w-6 h-6" strokeWidth={2.5} />
            </span>
          </NavLink>
          {mobileBottomItems.slice(2, 4).map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              data-testid={`bottom-nav-${label.toLowerCase().replace(/\s+/g, "-")}`}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center py-2.5 text-[10px] font-semibold transition ${
                  isActive ? "text-[#4DA3FF]" : "text-slate-500"
                }`
              }
            >
              <Icon className="w-5 h-5 mb-0.5" />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
