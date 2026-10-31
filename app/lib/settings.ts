// Locator appearance + behaviour settings. Shared by server, admin UI and widget.

export type MapTheme = {
  id: string;
  name: string;
  // MapLibre style URL, or "satellite" for the built-in raster style
  style: string;
  // Optional CSS filter applied to the map canvas to create variants
  filter?: string;
};

const OFM = "https://tiles.openfreemap.org/styles";

export const MAP_THEMES: MapTheme[] = [
  { id: "streets", name: "Streets", style: `${OFM}/liberty` },
  { id: "bright", name: "Bright", style: `${OFM}/bright` },
  { id: "light", name: "Light", style: `${OFM}/positron` },
  { id: "midnight", name: "Midnight", style: `${OFM}/dark` },
  { id: "fiord", name: "Fiord", style: `${OFM}/fiord` },
  { id: "satellite", name: "Satellite", style: "satellite" },
  {
    id: "grayscale",
    name: "Grayscale",
    style: `${OFM}/positron`,
    filter: "grayscale(1)",
  },
  {
    id: "mono",
    name: "Mono",
    style: `${OFM}/liberty`,
    filter: "grayscale(1) contrast(1.1)",
  },
  {
    id: "vintage",
    name: "Vintage",
    style: `${OFM}/liberty`,
    filter: "sepia(0.6) saturate(0.8)",
  },
  {
    id: "pastel",
    name: "Pastel",
    style: `${OFM}/bright`,
    filter: "saturate(0.55) brightness(1.06)",
  },
  {
    id: "vivid",
    name: "Vivid",
    style: `${OFM}/bright`,
    filter: "saturate(1.6)",
  },
  {
    id: "ocean",
    name: "Ocean",
    style: `${OFM}/positron`,
    filter: "hue-rotate(170deg) saturate(1.4)",
  },
  {
    id: "noir",
    name: "Noir",
    style: `${OFM}/dark`,
    filter: "grayscale(1) contrast(1.2)",
  },
  {
    id: "dusk",
    name: "Dusk",
    style: `${OFM}/fiord`,
    filter: "hue-rotate(40deg) saturate(1.3)",
  },
];

export const MAP_LANGUAGES: { id: string; name: string }[] = [
  { id: "", name: "Local (default)" },
  { id: "en", name: "English" },
  { id: "es", name: "Spanish" },
  { id: "fr", name: "French" },
  { id: "de", name: "German" },
  { id: "it", name: "Italian" },
  { id: "pt", name: "Portuguese" },
  { id: "nl", name: "Dutch" },
  { id: "sv", name: "Swedish" },
  { id: "pl", name: "Polish" },
  { id: "ru", name: "Russian" },
  { id: "tr", name: "Turkish" },
  { id: "ar", name: "Arabic" },
  { id: "ur", name: "Urdu" },
  { id: "hi", name: "Hindi" },
  { id: "zh", name: "Chinese" },
  { id: "ja", name: "Japanese" },
  { id: "ko", name: "Korean" },
];

export const FONTS = [
  "Inter",
  "Roboto",
  "Open Sans",
  "Lato",
  "Montserrat",
  "Poppins",
  "Playfair Display",
  "Merriweather",
  "DM Sans",
  "Work Sans",
  "system-ui",
];

export type LocatorSettings = {
  title: string;
  theme: string;
  language: string;
  primaryColor: string;
  textColor: string;
  backgroundColor: string;
  fontFamily: string;
  borderRadius: number;
  listPosition: "left" | "right";
  units: "km" | "mi";
  defaultLat: number;
  defaultLng: number;
  defaultZoom: number;
  // "fit" = zoom to show all locations, "fixed" = use defaultLat/Lng/Zoom
  initialView: "fit" | "fixed";
  useVisitorLocation: boolean;
  searchPlaceholder: string;
  showCategoryFilter: boolean;
  showDirections: boolean;
  resultLimit: number;
  googleAnalytics: boolean;
  pinIconUrl: string;
  searchRadiusKm: number;
};

export const DEFAULT_SETTINGS: LocatorSettings = {
  title: "Find a store",
  theme: "streets",
  language: "",
  primaryColor: "#1f6feb",
  textColor: "#1b1f24",
  backgroundColor: "#ffffff",
  fontFamily: "Inter",
  borderRadius: 10,
  listPosition: "left",
  units: "km",
  defaultLat: 40.7128,
  defaultLng: -74.006,
  defaultZoom: 3,
  initialView: "fit",
  useVisitorLocation: true,
  searchPlaceholder: "Search by city, address or postcode",
  showCategoryFilter: true,
  showDirections: true,
  resultLimit: 50,
  googleAnalytics: true,
  pinIconUrl: "",
  searchRadiusKm: 50,
};

const HEX = /^#[0-9a-f]{6}$/i;

export function parseSettings(raw: string | null | undefined): LocatorSettings {
  let obj: Record<string, unknown> = {};
  try {
    obj = raw ? JSON.parse(raw) : {};
  } catch {
    obj = {};
  }
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) obj = {};
  return sanitizeSettings(obj);
}

function num(v: unknown, def: number, min: number, max: number) {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, n));
}

function str(v: unknown, def: string, max = 200) {
  return typeof v === "string" ? v.slice(0, max) : def;
}

function bool(v: unknown, def: boolean) {
  if (typeof v === "boolean") return v;
  if (v === "on" || v === "true") return true;
  if (v === "false" || v === "off") return false;
  return def;
}

export function sanitizeSettings(o: Record<string, unknown>): LocatorSettings {
  const d = DEFAULT_SETTINGS;
  const color = (v: unknown, def: string) =>
    typeof v === "string" && HEX.test(v) ? v : def;
  return {
    title: str(o.title, d.title, 80),
    theme: MAP_THEMES.some((t) => t.id === o.theme)
      ? (o.theme as string)
      : d.theme,
    language: MAP_LANGUAGES.some((l) => l.id === o.language)
      ? (o.language as string)
      : d.language,
    primaryColor: color(o.primaryColor, d.primaryColor),
    textColor: color(o.textColor, d.textColor),
    backgroundColor: color(o.backgroundColor, d.backgroundColor),
    fontFamily: FONTS.includes(o.fontFamily as string)
      ? (o.fontFamily as string)
      : d.fontFamily,
    borderRadius: num(o.borderRadius, d.borderRadius, 0, 24),
    listPosition: o.listPosition === "right" ? "right" : "left",
    units: o.units === "mi" ? "mi" : "km",
    defaultLat: num(o.defaultLat, d.defaultLat, -90, 90),
    defaultLng: num(o.defaultLng, d.defaultLng, -180, 180),
    defaultZoom: num(o.defaultZoom, d.defaultZoom, 1, 18),
    initialView: o.initialView === "fixed" ? "fixed" : "fit",
    useVisitorLocation: bool(o.useVisitorLocation, d.useVisitorLocation),
    searchPlaceholder: str(o.searchPlaceholder, d.searchPlaceholder, 120),
    showCategoryFilter: bool(o.showCategoryFilter, d.showCategoryFilter),
    showDirections: bool(o.showDirections, d.showDirections),
    resultLimit: num(o.resultLimit, d.resultLimit, 5, 500),
    googleAnalytics: bool(o.googleAnalytics, d.googleAnalytics),
    pinIconUrl:
      typeof o.pinIconUrl === "string" && /^https:\/\//i.test(o.pinIconUrl)
        ? o.pinIconUrl.slice(0, 1000)
        : "",
    searchRadiusKm: num(o.searchRadiusKm, d.searchRadiusKm, 1, 1000),
  };
}

// Checkbox fields are absent from FormData when unchecked.
export const BOOLEAN_SETTING_KEYS = [
  "useVisitorLocation",
  "showCategoryFilter",
  "showDirections",
  "googleAnalytics",
] as const;

export function settingsFromForm(form: FormData): LocatorSettings {
  const o: Record<string, unknown> = {};
  for (const [k, v] of form.entries()) o[k] = v;
  for (const k of BOOLEAN_SETTING_KEYS) o[k] = form.get(k) === "on";
  return sanitizeSettings(o);
}

export const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export const DAY_LABELS: Record<(typeof DAYS)[number], string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};
