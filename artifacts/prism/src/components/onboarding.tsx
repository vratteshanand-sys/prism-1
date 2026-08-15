import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Lightbulb } from "lucide-react";
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

const RAINBOW = ["#ff4d4d", "#ff9f40", "#ffe14d", "#4ade80", "#38bdf8", "#5b7cff", "#b45bff"];

/**
 * Interactive prism-refracting-light hero — the splash screen centerpiece.
 * A white beam enters, refracts through the glass, exits as a rainbow fan.
 * Idle: continuous float + shimmer loop. On mouse move: parallax tilt (perspective
 * rotate) tracking the cursor, like the glass is catching the light toward you.
 */
function PrismHero({ intensified }: { intensified: boolean }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  function handleMove(e: React.MouseEvent) {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({ x: py * -16, y: px * 22 });
  }

  return (
    <div
      ref={wrapRef}
      onMouseMove={handleMove}
      onMouseLeave={() => setTilt({ x: 0, y: 0 })}
      className="relative w-full max-w-xl mx-auto"
      style={{ perspective: "1000px" }}
    >
      {/* Ambient color wash behind the glass */}
      <div
        className="glow-breathe pointer-events-none absolute inset-0 blur-3xl"
        style={{ background: "radial-gradient(ellipse at 45% 55%, hsl(224 80% 60% / 0.35), transparent 65%)" }}
      />

      <div
        className="prism-float"
        style={{
          transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale(${intensified ? 1.04 : 1})`,
          transition: "transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)",
          transformStyle: "preserve-3d",
        }}
      >
        <svg viewBox="0 0 640 300" className="w-full h-auto relative z-10">
          <defs>
            <linearGradient id="prism-glass" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(210 90% 85% / 0.4)" />
              <stop offset="100%" stopColor="hsl(224 70% 55% / 0.08)" />
            </linearGradient>
            <filter id="prism-glow" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="3.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Incoming white light beam — wide soft halo + crisp core, so it reads at any size.
              Note: no filter here — a perfectly horizontal line has a zero-height bounding
              box, and percentage-based SVG filter regions collapse to nothing on one, so the
              glow filter silently no-ops on this element. The halo/core layering does the
              same visual job without depending on the filter. */}
          <line
            x1="10" y1="150" x2="285" y2="150"
            stroke="white" strokeLinecap="round" strokeWidth="10"
            opacity="0.35"
          />
          <line
            x1="10" y1="150" x2="285" y2="150"
            stroke="white" strokeLinecap="round" strokeWidth="4"
            className="beam-pulse"
          />

          {/* Rainbow fan, refracting out the far side of the glass */}
          {RAINBOW.map((color, i) => (
            <line
              key={color}
              x1="330" y1="150"
              x2="628" y2={80 + i * 24}
              stroke={color}
              strokeWidth="3.5"
              strokeLinecap="round"
              filter="url(#prism-glow)"
              className="rainbow-band"
              style={{ animationDelay: `${i * 0.18}s`, opacity: intensified ? 1 : undefined }}
            />
          ))}

          {/* Glass prism */}
          <polygon
            points="320,40 400,220 240,220"
            fill="url(#prism-glass)"
            stroke="hsl(210 90% 88% / 0.85)"
            strokeWidth="1.75"
            strokeLinejoin="round"
            filter="url(#prism-glow)"
          />
          {/* Internal refraction lines, echoing the sidebar mark */}
          <line x1="320" y1="100" x2="356" y2="220" stroke="white" strokeWidth="1" opacity="0.35" />
          <line x1="320" y1="100" x2="284" y2="220" stroke="white" strokeWidth="1" opacity="0.22" />

          {/* Glint where the beam strikes the glass */}
          <circle cx="300" cy="150" r="5" fill="white" filter="url(#prism-glow)" className="sparkle-twinkle" />
        </svg>
      </div>
    </div>
  );
}

function Splash({ onEnter }: { onEnter: () => void }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center cursor-pointer select-none overflow-hidden"
      style={{ background: "hsl(222 28% 7%)" }}
      onClick={onEnter}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      role="button"
      aria-label="Enter PRISM"
    >
      <div className="flex flex-col items-center rise-in w-full px-6">
        <PrismHero intensified={hovered} />
        <div className="text-5xl font-bold tracking-tight text-white mt-2">PRISM</div>
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
          Move your cursor, then click anywhere to begin
        </div>
      </div>
    </div>
  );
}

/**
 * Whole-app overview — bridges the splash (just a mark) and the per-module
 * walkthrough (one thing at a time). Answers "what is this, broadly" with
 * real color and motion before narrowing into details.
 */
function Overview({ onContinue }: { onContinue: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center px-6 overflow-hidden cursor-default"
      style={{ background: "hsl(222 28% 7%)" }}
    >
      {/* Full-spectrum ambient wash — the "many colors, one lens" idea made literal */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        {RAINBOW.map((color, i) => (
          <div
            key={color}
            className="glow-breathe absolute rounded-full blur-3xl"
            style={{
              background: color,
              opacity: 0.14,
              width: "22rem",
              height: "22rem",
              left: `${4 + i * 13}%`,
              top: `${10 + (i % 3) * 24}%`,
              animationDelay: `${i * 0.35}s`,
              animationDuration: `${5 + (i % 3)}s`,
            }}
          />
        ))}
      </div>

      <div className="relative rise-in max-w-2xl text-center">
        <div className="text-xs font-bold uppercase tracking-[0.35em] mb-4" style={{ color: "hsl(224 70% 68%)" }}>
          What is PRISM?
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-white leading-tight mb-6">
          One lens.<br />Seven ways to watch your digital life.
        </h1>
        <p className="text-white/70 text-lg leading-relaxed mb-10 max-w-xl mx-auto">
          PRISM splits your security posture the way a glass prism splits light —
          into distinct, color-coded beams. Each module below watches one angle:
          your code, your AI content, the links you click, your money, and this
          very device. Together they're one picture. Individually, each is sharp.
        </p>

        {/* Quick colorful taste of what's coming — full detail is next, one at a time */}
        <div className="flex flex-wrap items-center justify-center gap-2.5 mb-10">
          {STEPS.map((m, i) => {
            const Icon = m.icon;
            return (
              <div
                key={m.key}
                className="icon-pop-in flex items-center gap-2 px-3.5 py-2 rounded-full border"
                style={{
                  background: `color-mix(in srgb, ${m.hsl} 14%, transparent)`,
                  borderColor: `color-mix(in srgb, ${m.hsl} 35%, transparent)`,
                  animationDelay: `${300 + i * 90}ms`,
                }}
              >
                <Icon className="w-3.5 h-3.5" style={{ color: m.hsl }} />
                <span className="text-xs font-bold" style={{ color: m.hsl }}>{m.name}</span>
              </div>
            );
          })}
        </div>

        <button
          onClick={onContinue}
          className="inline-flex items-center gap-2 text-sm font-bold px-7 py-3 rounded-lg text-white press-scale hover-lift transition-all"
          style={{ background: "hsl(224 62% 55%)" }}
        >
          Show me how each one works <ChevronRight className="w-4 h-4" />
        </button>
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
      className="fixed inset-0 z-50 flex flex-col items-center justify-center px-6 overflow-hidden"
      style={{ background: "hsl(222 28% 7%)" }}
    >
      {/* Ambient glow matching the current module's color — recolors per step */}
      <div
        key={module.key}
        className="glow-breathe pointer-events-none absolute rounded-full blur-3xl"
        style={{
          background: module.hsl,
          opacity: 0.22,
          width: "36rem",
          height: "36rem",
          left: "50%",
          top: "45%",
          transform: "translate(-50%, -50%)",
        }}
        aria-hidden
      />

      {/* Progress dots — each colored to its own module, so the trail ahead reads as a spectrum */}
      <div className="relative flex items-center gap-2 mb-10">
        {STEPS.map((s, i) => (
          <div
            key={s.key}
            className="h-1.5 rounded-full transition-all duration-300"
            style={{
              width: i === step ? "1.75rem" : "0.4rem",
              background: i <= step ? s.hsl : "hsl(222 28% 20%)",
              opacity: i <= step ? 1 : 0.6,
            }}
          />
        ))}
      </div>

      <div key={module.key} className="relative w-full max-w-lg rise-in">
        <div className="text-xs font-mono text-white/40 mb-3 tracking-widest">
          {String(step + 1).padStart(2, "0")} / {String(STEPS.length).padStart(2, "0")}
        </div>

        <div
          className="icon-pop-in w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
          style={{ background: `color-mix(in srgb, ${module.hsl} 18%, transparent)`, boxShadow: `0 0 40px -8px ${module.hsl}` }}
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
          <div
            className="flex gap-3 p-4 rounded-xl border text-sm leading-relaxed text-white/70"
            style={{ borderColor: `color-mix(in srgb, ${module.hsl} 25%, transparent)`, background: `color-mix(in srgb, ${module.hsl} 6%, transparent)` }}
          >
            <Lightbulb className="w-4 h-4 shrink-0 mt-0.5" style={{ color: module.hsl }} />
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
              style={{ background: module.hsl }}
            >
              Enter PRISM
            </button>
          ) : (
            <button
              onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
              className="flex items-center gap-1.5 text-sm font-bold px-6 py-2.5 rounded-lg text-white press-scale hover-lift transition-all"
              style={{ background: module.hsl }}
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
  const [phase, setPhase] = useState<"splash" | "overview" | "walkthrough">("splash");

  if (phase === "splash") {
    return <Splash onEnter={() => setPhase("overview")} />;
  }
  if (phase === "overview") {
    return <Overview onContinue={() => setPhase("walkthrough")} />;
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
