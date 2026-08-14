import {
  LayoutDashboard,
  ShieldAlert,
  Fingerprint,
  Lock,
  ShieldCheck,
  MonitorSmartphone,
  FileText,
  HardDrive,
  type LucideIcon,
} from "lucide-react";

/**
 * The prism spectrum: every module owns one signature color, used
 * consistently in the sidebar, cards, charts, and score visuals.
 */
export interface ModuleTheme {
  key: string;
  name: string;
  href: string;
  icon: LucideIcon;
  /** One-sentence "what this protects you from" for teachy banners. */
  protects: string;
  /** One-sentence "what it does" for first-time orientation (module picker). */
  does: string;
  /** Tailwind text color */
  text: string;
  /** Tailwind bg tint (10-15%) */
  tint: string;
  /** Tailwind border tint */
  borderTint: string;
  /** Solid bg for chips/icons */
  solid: string;
  /** CSS color for inline styles / charts */
  hsl: string;
}

export const MODULES: Record<string, ModuleTheme> = {
  dashboard: {
    key: "dashboard",
    name: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
    protects: "Your whole security picture, in one glance.",
    does: "Aggregates every module into one live risk overview.",
    text: "text-foreground",
    tint: "bg-muted",
    borderTint: "border-border",
    solid: "bg-foreground",
    hsl: "hsl(230 100% 60%)",
  },
  supplychain: {
    key: "supplychain",
    name: "Supply Chain",
    href: "/supplychain",
    icon: ShieldAlert,
    protects:
      "Hidden security holes inside the software packages your project depends on.",
    does: "Scans package.json / requirements.txt against live CVE data and flags vulnerable dependencies.",
    text: "text-amber-600 dark:text-amber-400",
    tint: "bg-amber-500/10",
    borderTint: "border-amber-500/30",
    solid: "bg-amber-500",
    hsl: "hsl(38 92% 50%)",
  },
  sentinel: {
    key: "sentinel",
    name: "Sentinel AI",
    href: "/sentinel",
    icon: Fingerprint,
    protects:
      "Unsafe, biased, or made-up claims hiding inside AI-generated text.",
    does: "Grades AI-generated text on 6 dimensions — safety, factuality, bias, toxicity, coherence, hallucination.",
    text: "text-violet-600 dark:text-violet-400",
    tint: "bg-violet-500/10",
    borderTint: "border-violet-500/30",
    solid: "bg-violet-500",
    hsl: "hsl(262 83% 58%)",
  },
  trustlens: {
    key: "trustlens",
    name: "TrustLens",
    href: "/trustlens",
    icon: Lock,
    protects:
      "Phishing links, sneaky privacy policies, and manipulative cookie banners.",
    does: "Audits URLs, privacy policies, and cookie banners for GDPR/CCPA compliance risk, with regulation citations.",
    text: "text-cyan-600 dark:text-cyan-400",
    tint: "bg-cyan-500/10",
    borderTint: "border-cyan-500/30",
    solid: "bg-cyan-500",
    hsl: "hsl(189 94% 43%)",
  },
  finguard: {
    key: "finguard",
    name: "FinGuard",
    href: "/finguard",
    icon: ShieldCheck,
    protects: "Fraud patterns buried inside your transaction history.",
    does: "Reads your transaction ledger like a fraud analyst and flags suspicious patterns.",
    text: "text-emerald-600 dark:text-emerald-400",
    tint: "bg-emerald-500/10",
    borderTint: "border-emerald-500/30",
    solid: "bg-emerald-500",
    hsl: "hsl(152 76% 40%)",
  },
  devicescan: {
    key: "devicescan",
    name: "Device Scan",
    href: "/devicescan",
    icon: MonitorSmartphone,
    protects:
      "Outdated browsers and the invisible fingerprint your device leaves on every website.",
    does: "Reveals what your browser exposes to every site you visit, plus a deep Mac security posture check.",
    text: "text-blue-600 dark:text-blue-400",
    tint: "bg-blue-500/10",
    borderTint: "border-blue-500/30",
    solid: "bg-blue-500",
    hsl: "hsl(217 91% 60%)",
  },
  guard: {
    key: "guard",
    name: "Guard",
    href: "/guard",
    icon: HardDrive,
    protects:
      "Suspicious hardware plugged into your Mac and risky networks it connects to.",
    does: "Inventories every device plugged into your machine and flags anything new or untrusted.",
    text: "text-orange-600 dark:text-orange-400",
    tint: "bg-orange-500/10",
    borderTint: "border-orange-500/30",
    solid: "bg-orange-500",
    hsl: "hsl(24 95% 53%)",
  },
  reports: {
    key: "reports",
    name: "Reports",
    href: "/reports",
    icon: FileText,
    protects: "Losing track — every scan you have ever run, in one place.",
    does: "One searchable timeline of every scan you've ever run, across every module.",
    text: "text-rose-600 dark:text-rose-400",
    tint: "bg-rose-500/10",
    borderTint: "border-rose-500/30",
    solid: "bg-rose-500",
    hsl: "hsl(350 89% 60%)",
  },
};

/** Map loose module labels (from activity feeds / reports) to themes. */
export function themeForLabel(label: string): ModuleTheme {
  const l = label.toLowerCase();
  if (l.includes("supply")) return MODULES.supplychain;
  if (l.includes("sentinel")) return MODULES.sentinel;
  if (l.includes("url") || l.includes("policy") || l.includes("cookie") || l.includes("trustlens"))
    return MODULES.trustlens;
  if (l.includes("fin")) return MODULES.finguard;
  if (l.includes("guard") && l.includes("hardware")) return MODULES.guard;
  if (l === "guard") return MODULES.guard;
  if (l.includes("device")) return MODULES.devicescan;
  return MODULES.reports;
}
