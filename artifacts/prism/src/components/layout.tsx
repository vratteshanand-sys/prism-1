import { useEffect, useState } from "react";
import { useLocation, Link as WouterLink } from "wouter";
import { ChevronRight, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { MODULES } from "@/lib/modules";
import { PrismMark } from "@/components/prism-mark";

function useDarkMode() {
  const [dark, setDark] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem("prism-dark");
      if (stored !== null) return stored === "true";
    } catch {}
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    try { localStorage.setItem("prism-dark", String(dark)); } catch {}
  }, [dark]);

  return [dark, setDark] as const;
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [dark, setDark] = useDarkMode();

  const nav = [
    MODULES.dashboard,
    MODULES.supplychain,
    MODULES.sentinel,
    MODULES.trustlens,
    MODULES.finguard,
    MODULES.devicescan,
    MODULES.guard,
    MODULES.reports,
  ];

  return (
    <div className="flex min-h-[100dvh] w-full bg-background flex-col md:flex-row">
      {/* Sidebar */}
      <aside
        className="w-full md:w-56 shrink-0 flex flex-col z-20 sticky top-0 h-[100dvh]"
        style={{ background: "hsl(var(--sidebar))", borderRight: "1px solid hsl(var(--sidebar-border))" }}
      >
        {/* Logo */}
        <div className="px-5 pt-6 pb-5">
          <div className="flex items-center gap-2.5">
            <div
              className="w-7 h-7 rounded flex items-center justify-center shrink-0"
              style={{ color: "hsl(var(--sidebar-primary))", background: "hsl(var(--sidebar-accent))" }}
            >
              <PrismMark className="w-4 h-4" />
            </div>
            <div>
              <div
                className="font-bold text-base tracking-tight leading-none"
                style={{ color: "hsl(var(--sidebar-accent-foreground))" }}
              >
                PRISM
              </div>
              <div
                className="text-[0.6rem] tracking-widest uppercase mt-0.5"
                style={{ color: "hsl(var(--sidebar-foreground))", opacity: 0.5 }}
              >
                Security Intelligence
              </div>
            </div>
          </div>
          <div className="prism-bar mt-4 opacity-40" />
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 pb-2 space-y-0.5 overflow-y-auto">
          {nav.map((item) => {
            const isActive = location === item.href;
            const Icon = item.icon;
            return (
              <WouterLink key={item.name} href={item.href} className="block group/nav">
                <div
                  className={cn(
                    "relative flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm transition-all duration-200",
                    isActive ? "font-medium" : "font-normal hover:bg-white/[0.06] hover:translate-x-0.5",
                  )}
                  style={{
                    background: isActive ? "hsl(var(--sidebar-accent))" : "transparent",
                    color: isActive ? "hsl(var(--sidebar-accent-foreground))" : "hsl(var(--sidebar-foreground))",
                  }}
                >
                  {/* Module color indicator strip */}
                  <span
                    className={cn("w-0.5 h-4 rounded-full shrink-0", isActive && "nav-indicator-active")}
                    style={{ background: isActive ? item.hsl : "transparent", transformOrigin: "center" }}
                  />
                  <Icon className="w-3.5 h-3.5 shrink-0 transition-transform duration-200 group-hover/nav:scale-110" />
                  <span className="truncate">{item.name}</span>
                  {isActive && (
                    <ChevronRight className="w-3 h-3 ml-auto shrink-0 opacity-50" />
                  )}
                </div>
              </WouterLink>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-3 pb-4 border-t" style={{ borderColor: "hsl(var(--sidebar-border))", paddingTop: "12px" }}>
          <button
            onClick={() => setDark((d) => !d)}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm transition-all duration-200 hover:bg-white/[0.06] press-scale group/toggle"
            style={{ color: "hsl(var(--sidebar-foreground))" }}
            aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
          >
            <span className="w-0.5 h-4 rounded-full shrink-0" />
            <span className="transition-transform duration-300 group-hover/toggle:rotate-12">
              {dark ? <Sun className="w-3.5 h-3.5 shrink-0" /> : <Moon className="w-3.5 h-3.5 shrink-0" />}
            </span>
            {dark ? "Light mode" : "Dark mode"}
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0 bg-background relative flex flex-col">
        {children}
      </main>
    </div>
  );
}
