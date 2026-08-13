import { cn } from "@/lib/utils";

/**
 * ScoreRing — animated SVG ring gauge.
 * `invert` = true means high score is GOOD (trust scores);
 * default means high score is BAD (risk scores).
 */
export function ScoreRing({
  score,
  size = 120,
  strokeWidth = 10,
  invert = false,
  label,
  sublabel,
  className,
}: {
  score: number;
  size?: number;
  strokeWidth?: number;
  invert?: boolean;
  label?: string;
  sublabel?: string;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, score));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);

  const severity = invert ? 100 - clamped : clamped;
  const color =
    severity >= 80
      ? "hsl(0 84% 60%)"
      : severity >= 40
        ? "hsl(38 92% 50%)"
        : "hsl(152 76% 45%)";

  return (
    <div className={cn("flex flex-col items-center", className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-muted"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="score-ring-arc"
            style={{ ["--ring-circumference" as string]: circumference }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono font-bold" style={{ color, fontSize: size / 4 }}>
            {clamped}
          </span>
          <span className="text-[0.6rem] text-muted-foreground -mt-0.5">/100</span>
        </div>
      </div>
      {label && <div className="mt-2 text-sm font-semibold text-center">{label}</div>}
      {sublabel && <div className="text-xs text-muted-foreground text-center">{sublabel}</div>}
    </div>
  );
}
