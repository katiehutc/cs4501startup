import type { FirmMatch } from "../contracts";
type Firm = Extract<FirmMatch, { kind: "match" }>["firm"];

export const FIRMS: Firm[] = [
  { id: "gs", name: "Goldman Sachs", tier: "Bulge bracket", aliases: ["Goldman", "GS"] },
  { id: "ms", name: "Morgan Stanley", tier: "Bulge bracket", aliases: ["MS"] },
  { id: "jpm", name: "J.P. Morgan", tier: "Bulge bracket", aliases: ["JPM", "JP Morgan", "JPMorgan"] },
  { id: "bofa", name: "Bank of America", tier: "Bulge bracket", aliases: ["BofA", "BAML"] },
  { id: "citi", name: "Citigroup", tier: "Bulge bracket", aliases: ["Citi", "Citibank"] },
  { id: "barc", name: "Barclays", tier: "Bulge bracket", aliases: ["Barclays Capital"] },
  { id: "ubs", name: "UBS", tier: "Bulge bracket", aliases: ["UBS Investment Bank"] },
  { id: "db", name: "Deutsche Bank", tier: "Bulge bracket", aliases: ["DB"] },
  { id: "wf", name: "Wells Fargo", tier: "Bulge bracket", aliases: ["WF"] },
  { id: "jeff", name: "Jefferies", tier: "Middle market", aliases: ["Jefferies Group"] },
  { id: "rbc", name: "RBC Capital Markets", tier: "Middle market", aliases: ["RBC"] },
  { id: "baird", name: "Baird", tier: "Middle market", aliases: ["Robert W. Baird"] },
  { id: "piper", name: "Piper Sandler", tier: "Middle market", aliases: ["Piper"] },
  { id: "hl", name: "Houlihan Lokey", tier: "Middle market", aliases: ["HL"] },
  { id: "gugg", name: "Guggenheim Securities", tier: "Middle market", aliases: ["Guggenheim", "GS"] },
  { id: "evr", name: "Evercore", tier: "Elite boutique", aliases: ["EVR"] },
  { id: "laz", name: "Lazard", tier: "Elite boutique", aliases: ["Lazard Freres"] },
  { id: "cvp", name: "Centerview", tier: "Elite boutique", aliases: ["CVP", "Centerview Partners"] },
  { id: "pjt", name: "PJT Partners", tier: "Elite boutique", aliases: ["PJT"] },
  { id: "moelis", name: "Moelis", tier: "Elite boutique", aliases: ["Moelis & Company"] },
  { id: "roth", name: "Rothschild & Co", tier: "Elite boutique", aliases: ["Rothschild"] },
];

export const GROUPS: string[] = [
  "M&A",
  "FIG",
  "TMT",
  "Healthcare",
  "Industrials",
  "Consumer & Retail",
  "Energy",
  "Real Estate",
  "Restructuring",
  "LevFin",
  "ECM",
  "DCM",
];

export const TITLES: string[] = [
  "Analyst",
  "Associate",
  "VP",
  "Director",
  "MD",
];
