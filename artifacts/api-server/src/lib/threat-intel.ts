export const THREAT_INTEL = [
  {
    id: 1,
    name: "Confirmshaming",
    category: "Emotional Manipulation",
    severity: "medium",
    description:
      "Decline options worded to make users feel guilty or foolish, e.g. 'No thanks, I hate saving money.' Pressures users into consenting through shame rather than informed choice.",
    prevalence: "Very common on e-commerce and newsletter pop-ups",
    platforms: ["E-commerce", "News sites", "SaaS"],
  },
  {
    id: 2,
    name: "Roach Motel",
    category: "Obstruction",
    severity: "high",
    description:
      "Easy to get into a situation (subscribe in one click) but deliberately difficult to get out (cancellation requires phone calls, hidden menus, or multi-step retention flows).",
    prevalence: "Common in subscription services",
    platforms: ["Streaming", "SaaS", "Gyms & memberships"],
  },
  {
    id: 3,
    name: "Drip Pricing",
    category: "Deceptive Pricing",
    severity: "high",
    description:
      "Advertising a low headline price, then adding mandatory fees, taxes, and charges step by step during checkout so the final price is far higher than advertised.",
    prevalence: "Widespread in travel and ticketing",
    platforms: ["Airlines", "Ticketing", "Hotels", "Food delivery"],
  },
  {
    id: 4,
    name: "Forced Continuity",
    category: "Deceptive Pricing",
    severity: "high",
    description:
      "Free trials that silently convert into paid subscriptions without a clear reminder, often requiring card details upfront and making cancellation deadlines easy to miss.",
    prevalence: "Very common in free-trial products",
    platforms: ["Streaming", "Apps", "SaaS"],
  },
  {
    id: 5,
    name: "Privacy Zuckering",
    category: "Privacy Intrusion",
    severity: "critical",
    description:
      "Interfaces engineered to trick users into sharing more personal data than intended — confusing privacy settings, bundled consents, and defaults set to maximum data collection.",
    prevalence: "Common on social platforms and ad-funded services",
    platforms: ["Social media", "Mobile apps", "Ad networks"],
  },
  {
    id: 6,
    name: "Fake Urgency & Scarcity",
    category: "Pressure Tactics",
    severity: "medium",
    description:
      "Countdown timers that reset, 'only 2 left!' badges, and ' 12 people are viewing this' claims that are fabricated or unverifiable, pressuring rushed decisions.",
    prevalence: "Very common in e-commerce and travel booking",
    platforms: ["E-commerce", "Travel", "Ticketing"],
  },
  {
    id: 7,
    name: "Misdirection (Visual Interference)",
    category: "Interface Manipulation",
    severity: "medium",
    description:
      "Visual design that steers attention toward the choice the company wants — a bright 'Accept all' button next to a gray, low-contrast 'Manage options' link.",
    prevalence: "Nearly universal in cookie consent banners",
    platforms: ["Cookie banners", "Checkout flows", "Upgrade prompts"],
  },
  {
    id: 8,
    name: "Sneak into Basket",
    category: "Deceptive Commerce",
    severity: "high",
    description:
      "Items, insurance, or donations added to the shopping cart without an explicit user action, relying on users not noticing before payment.",
    prevalence: "Declining due to regulation but still present",
    platforms: ["E-commerce", "Airlines", "Event ticketing"],
  },
  {
    id: 9,
    name: "Nagging",
    category: "Obstruction",
    severity: "low",
    description:
      "Repeated interruptions asking users to enable notifications, rate the app, or upgrade — with 'remind me later' but rarely a permanent 'no'.",
    prevalence: "Very common in mobile apps",
    platforms: ["Mobile apps", "Browsers", "Desktop software"],
  },
  {
    id: 10,
    name: "Bait and Switch",
    category: "Deceptive Commerce",
    severity: "critical",
    description:
      "Advertising one product, price, or outcome and delivering another — including UI elements that perform a different action than their label or appearance suggests.",
    prevalence: "Less common but high impact",
    platforms: ["Ads", "Downloads", "E-commerce"],
  },
] as const;
