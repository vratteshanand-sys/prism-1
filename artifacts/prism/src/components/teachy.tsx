import { useEffect, useId, useState } from "react";
import { HelpCircle, X, GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ModuleTheme } from "@/lib/modules";

/**
 * Explainer — a small "What does this mean?" toggle that reveals a
 * plain-language explanation right where the jargon appears.
 */
export function Explainer({
  label = "What does this mean?",
  children,
  className,
  tone = "default",
}: {
  label?: string;
  children: React.ReactNode;
  className?: string;
  /** "light" renders white-on-dark, for use on colored/gradient cards. */
  tone?: "default" | "light";
}) {
  const [open, setOpen] = useState(false);
  const contentId = useId();
  return (
    <div className={cn("text-left", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={contentId}
        className={cn(
          "inline-flex items-center gap-1 text-xs font-medium transition-colors",
          tone === "light" ? "text-white/80 hover:text-white" : "text-primary/80 hover:text-primary",
        )}
      >
        <HelpCircle className="w-3.5 h-3.5" />
        {open ? "Got it, hide this" : label}
      </button>
      {open && (
        <div
          id={contentId}
          role="region"
          className={cn(
            "mt-2 p-3 rounded-lg border text-xs leading-relaxed rise-in",
            tone === "light"
              ? "bg-white/10 border-white/20 text-white/90"
              : "bg-primary/5 border-primary/15 text-foreground/80",
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
}

/**
 * ModuleBanner — one-sentence "what this module protects you from",
 * tinted with the module's signature color.
 */
export function ModuleBanner({ theme }: { theme: ModuleTheme }) {
  const Icon = theme.icon;
  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded border text-sm rise-in bg-muted/40"
      style={{ borderLeft: `3px solid ${theme.hsl}` }}
    >
      <Icon className="w-4 h-4 shrink-0" style={{ color: theme.hsl }} />
      <p>
        <span className="font-semibold" style={{ color: theme.hsl }}>What this protects you from:</span>{" "}
        <span className="text-muted-foreground">{theme.protects}</span>
      </p>
    </div>
  );
}

/**
 * WhyWhatTo — plain-language "Why this matters / What to do" block for findings.
 */
export function WhyWhatTo({ why, whatToDo }: { why: string; whatToDo: string }) {
  return (
    <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
      <div className="p-2.5 rounded-md bg-amber-500/5 border border-amber-500/15">
        <span className="font-semibold text-amber-600 dark:text-amber-400">Why this matters: </span>
        <span className="text-muted-foreground">{why}</span>
      </div>
      <div className="p-2.5 rounded-md bg-emerald-500/5 border border-emerald-500/15">
        <span className="font-semibold text-emerald-600 dark:text-emerald-400">What to do: </span>
        <span className="text-muted-foreground">{whatToDo}</span>
      </div>
    </div>
  );
}

/** Plain-language advice for a severity + finding, used where the API has no advice text. */
export function severityAdvice(severity: string): { why: string; whatToDo: string } {
  switch (severity) {
    case "critical":
      return {
        why: "This is the kind of weakness attackers actively look for and exploit first.",
        whatToDo: "Treat this as urgent — fix or remove it before doing anything else.",
      };
    case "high":
      return {
        why: "This meaningfully raises your chance of being compromised or tracked.",
        whatToDo: "Plan a fix soon — within days, not months.",
      };
    case "medium":
      return {
        why: "On its own this is manageable, but combined with other issues it adds up.",
        whatToDo: "Fix it during your next routine update or review.",
      };
    default:
      return {
        why: "This is informational — good to know, not dangerous by itself.",
        whatToDo: "No action needed; just keep an eye on it.",
      };
  }
}

const TOUR_KEY = "prism-tour-dismissed";

const TOUR_STEPS: { title: string; body: string }[] = [
  {
    title: "Welcome to PRISM",
    body: "PRISM watches your digital life from five angles — your software's ingredients, AI content, links and policies, money movements, and this very device. Each module has its own color, so you always know where you are.",
  },
  {
    title: "Scores are school grades",
    body: "Everything is scored 0-100. For risk scores, low is good (green), high is bad (red). Trust scores are the opposite: higher means safer. Colors always tell you which way to read it.",
  },
  {
    title: "Look for the explainers",
    body: 'Anywhere you see "What does this mean?", click it for a plain-language explanation. No security dictionary required.',
  },
  {
    title: "Start with a live scan",
    body: "The fastest wow: open Device Scan in the sidebar. It reads your real device, live — nothing is faked.",
  },
];

/**
 * GuidedTour — lightweight first-visit walkthrough on the dashboard.
 * Dismissal persists in localStorage.
 */
export function GuidedTour() {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    try {
      if (!localStorage.getItem(TOUR_KEY)) setVisible(true);
    } catch {
      // storage unavailable — skip the tour
    }
  }, []);

  const dismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(TOUR_KEY, "1");
    } catch {
      // ignore
    }
  };

  if (!visible) return null;
  const current = TOUR_STEPS[step];
  const last = step === TOUR_STEPS.length - 1;

  return (
    <div className="rounded-xl border border-primary/25 bg-gradient-to-r from-primary/10 via-violet-500/10 to-cyan-500/10 p-5 rise-in">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center text-white shrink-0">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold">{current.title}</div>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl leading-relaxed">{current.body}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss tour"
          className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="flex items-center justify-between mt-4">
        <div className="flex gap-1.5">
          {TOUR_STEPS.map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === step ? "w-6 bg-primary" : "w-1.5 bg-primary/25",
              )}
            />
          ))}
        </div>
        <div className="flex gap-2">
          {step > 0 && (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="text-xs font-medium px-3 py-1.5 rounded-md border hover:bg-muted transition-colors"
            >
              Back
            </button>
          )}
          <button
            type="button"
            onClick={() => (last ? dismiss() : setStep((s) => s + 1))}
            className="text-xs font-bold px-4 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            {last ? "Let's go" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
