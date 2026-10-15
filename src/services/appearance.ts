/**
 * Saved look of the app: font, size, and zoom.
 * Stored in the local SQLite database so it survives a restart.
 */

import { getDatabase } from "./database";

export const FONT_OPTIONS = [
  {
    id: "inter",
    label: "Inter",
    stack: '"Inter", system-ui, -apple-system, sans-serif',
  },
  {
    id: "jetbrains",
    label: "JetBrains Mono",
    stack: '"JetBrains Mono", "Fira Code", monospace',
  },
] as const;

export type FontFamilyId = (typeof FONT_OPTIONS)[number]["id"];

export interface AppearanceSettings {
  fontFamily: FontFamilyId;
  fontSizePx: number;
  zoomPercent: number;
}

export const DEFAULT_APPEARANCE: AppearanceSettings = {
  fontFamily: "inter",
  fontSizePx: 16,
  zoomPercent: 100,
};

const FONT_SIZE_MIN = 12;
const FONT_SIZE_MAX = 18;
const ZOOM_MIN = 80;
const ZOOM_MAX = 150;

const KEYS = {
  fontFamily: "fontFamily",
  fontSizePx: "fontSizePx",
  zoomPercent: "zoomPercent",
} as const;

function isFontFamilyId(value: string): value is FontFamilyId {
  return FONT_OPTIONS.some((option) => option.id === value);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function fontStackFor(id: FontFamilyId): string {
  const option = FONT_OPTIONS.find((item) => item.id === id);
  return option?.stack ?? FONT_OPTIONS[0].stack;
}

const TEXT_SCALE: Record<string, number> = {
  "--text-xs": 0.75,
  "--text-sm": 0.875,
  "--text-base": 1,
  "--text-lg": 1.125,
  "--text-xl": 1.25,
  "--text-2xl": 1.5,
  "--text-3xl": 2,
};

/** Write the saved look onto the page so the whole window scales together. */
export function applyAppearance(settings: AppearanceSettings): void {
  const root = document.documentElement;
  const font = fontStackFor(settings.fontFamily);
  root.style.setProperty("--font-sans", font);
  root.style.setProperty("--font-mono", font);
  root.style.setProperty("--app-font", font);
  root.style.fontFamily = font;
  // Keep 1rem at 16px so icon boxes and spacing stay put.
  root.style.fontSize = "16px";
  const scale = settings.fontSizePx / 16;
  for (const [token, size] of Object.entries(TEXT_SCALE)) {
    root.style.setProperty(token, `${size * scale}rem`);
  }
  root.style.removeProperty("zoom");
  root.style.setProperty("--app-zoom", String(settings.zoomPercent / 100));
}

function normalize(raw: Partial<Record<string, string>>): AppearanceSettings {
  const fontFamily =
    raw.fontFamily && isFontFamilyId(raw.fontFamily)
      ? raw.fontFamily
      : DEFAULT_APPEARANCE.fontFamily;

  const fontSize = Number(raw.fontSizePx);
  const zoom = Number(raw.zoomPercent);

  return {
    fontFamily,
    fontSizePx: Number.isFinite(fontSize)
      ? clamp(fontSize, FONT_SIZE_MIN, FONT_SIZE_MAX)
      : DEFAULT_APPEARANCE.fontSizePx,
    zoomPercent: Number.isFinite(zoom)
      ? clamp(zoom, ZOOM_MIN, ZOOM_MAX)
      : DEFAULT_APPEARANCE.zoomPercent,
  };
}

export async function getAppearance(): Promise<AppearanceSettings> {
  const database = await getDatabase();
  const rows = await database.select<{ key: string; value: string }[]>(
    "SELECT key, value FROM app_settings WHERE key IN (?, ?, ?)",
    [KEYS.fontFamily, KEYS.fontSizePx, KEYS.zoomPercent],
  );

  const raw: Partial<Record<string, string>> = {};
  for (const row of rows) {
    raw[row.key] = row.value;
  }
  return normalize(raw);
}

export async function saveAppearance(
  settings: AppearanceSettings,
): Promise<void> {
  const safe = normalize({
    fontFamily: settings.fontFamily,
    fontSizePx: String(settings.fontSizePx),
    zoomPercent: String(settings.zoomPercent),
  });

  const database = await getDatabase();
  const pairs: [string, string][] = [
    [KEYS.fontFamily, safe.fontFamily],
    [KEYS.fontSizePx, String(safe.fontSizePx)],
    [KEYS.zoomPercent, String(safe.zoomPercent)],
  ];

  for (const [key, value] of pairs) {
    await database.execute(
      `INSERT INTO app_settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [key, value],
    );
  }
}
