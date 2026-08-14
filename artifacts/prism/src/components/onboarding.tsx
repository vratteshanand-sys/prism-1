import { useState } from "react";
import { ChevronLeft, ChevronRight, Lightbulb } from "lucide-react";
import { PrismMark } from "@/components/prism-mark";
import { MODULES } from "@/lib/modules";
import { useOnboarded } from "@/hooks/use-onboarded";
import { cn } from "@/lib/utils";

/** Real navigable modules, in sidebar order — Dashboard itself isn't "a thing to learn about". */
const STEPS = [
  MODULES.supplychain,
  MODULES.sentinel,
  MODULES.trustlens,
  MODULES.finguard,
  MODULES.devicescan,
  MODULES.guard,
  MODULES.reports,
];

function Splash({ onEnter }: { onEnter: () => void }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center cursor-pointer select-none"
      style={{ background: "hsl(222 28% 7%)" }}
      onClick={onEnter}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      role="button"
      aria-label="Enter PRISM"
    >
      <div className="flex flex-col items-center rise-in">
        <div
          className="w-20 h-20 rounded-2xl flex items-center justify-center mb-6 transition-transform duration-500"
          style={{
            background: "hsl(224 62% 58% / 0.12)",
            color: "hsl(224 62% 60%)",
            transform: hovered ? "scale(1.06)" : "scale(1)",
          }}
        >
          <PrismMark className="w-11 h-11" />
        </div>
        <div className="text-5xl font-bold tracking-tight text-white">PRISM</div>
        <div
          className="text-xs tracking-[0.3em] uppercase mt-3 transition-all duration-500 overflow-hidden"
          style={{
            color: "hsl(215 20% 70%)",
            opacity: hovered ? 1 : 0,
            transform: hovered ? "translateY(0)" : "translateY(-6px)",
            maxHeight: hovered ? "2rem" : "0",
          }}
        >
          Security Intelligence
        </div>
        <div className="prism-bar w-40 mt-6 opacity-50" />
        <div
          className="text-xs text-white/40 mt-10 transition-opacity duration-700"
          style={{ opacity: hovered ? 0.7 : 0.35 }}
        >
          Click anywhere to begin
        </div>
      </div>
    </div>
  );
}

function Walkthrough({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(0);
  const module = STEPS[step];
  const Icon = module.icon;
  const isLast = step === STEPS.length - 1;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center px-6"
      style={{ background: "hsl(222 28% 7%)" }}
    >
      {/* Progress dots */}
      <div className="flex items-center gap-2 mb-10">
        {STEPS.map((s, i) => (
          <div
            key={s.key}
            className="h-1.5 rounded-full transition-all duration-300"
            style={{
              width: i === step ? "1.75rem" : "0.4rem",
              background: i <= step ? "hsl(224 62% 60%)" : "hsl(222 28% 20%)",
            }}
          />
        ))}
      </div>

      <div key={module.key} className="w-full max-w-lg rise-in">
        <div className="text-xs font-mono text-white/40 mb-3 tracking-widest">
          {String(step + 1).padStart(2, "0")} / {String(STEPS.length).padStart(2, "0")}
        </div>

        <div
          className="icon-pop-in w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
          style={{ background: `color-mix(in srgb, ${module.hsl} 16%, transparent)` }}
        >
          <Icon className="w-8 h-8" style={{ color: module.hsl }} />
        </div>

        <h2 className="text-3xl font-bold tracking-tight mb-3" style={{ color: module.hsl }}>
          {module.name}
        </h2>
        <p className="text-base text-white/80 leading-relaxed mb-5">
          {module.does}
        </p>

        {module.example && (
          <div className="flex gap-3 p-4 rounded-xl border border-white/10 bg-white/5 text-sm leading-relaxed text-white/70">
            <Lightbulb className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
            <div>
              <div className="text-xs font-bold uppercase tracking-wide text-white/40 mb-1">Example</div>
              {module.example}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mt-8">
          <button
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className={cn(
              "flex items-center gap-1.5 text-sm font-medium px-4 py-2.5 rounded-lg transition-all press-scale",
              step === 0 ? "opacity-0 pointer-events-none" : "text-white/60 hover:text-white hover:bg-white/5",
            )}
          >
            <ChevronLeft className="w-4 h-4" /> Back
          </button>

          {isLast ? (
            <button
              onClick={onComplete}
              className="flex items-center gap-1.5 text-sm font-bold px-6 py-2.5 rounded-lg text-white press-scale hover-lift transition-all"
              style={{ background: "hsl(224 62% 55%)" }}
            >
              Enter PRISM
            </button>
          ) : (
            <button
              onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
              className="flex items-center gap-1.5 text-sm font-bold px-6 py-2.5 rounded-lg text-white press-scale hover-lift transition-all"
              style={{ background: "hsl(224 62% 55%)" }}
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function OnboardingFlow({ onComplete }: { onComplete: () => void }) {
  const [phase, setPhase] = useState<"splash" | "walkthrough">("splash");

  if (phase === "splash") {
    return <Splash onEnter={() => setPhase("walkthrough")} />;
  }
  return <Walkthrough onComplete={onComplete} />;
}

/**
 * Hard gate — renders the splash + mandatory walkthrough instead of `children`
 * until the user has stepped through every module at least once. No skip.
 */
export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const { onboarded, complete } = useOnboarded();

  if (!onboarded) {
    return <OnboardingFlow onComplete={complete} />;
  }
  return <>{children}</>;
}
