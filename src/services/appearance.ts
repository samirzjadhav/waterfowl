/**
 * Saved look of the app: font, size, and zoom.
 * Stored in the local SQLite database so it survives a restart.
 */

import { getDatabase } from "./database";

export const FONT_OPTIONS = [
  {
    id: "segoe",
    label: "Segoe UI",
    stack: '"Segoe UI", sans-serif',
  },
  {
    id: "arial",
    label: "Arial",
    stack: "Arial, sans-serif",
  },
  {
    id: "georgia",
    label: "Georgia",
    stack: "Georgia, serif",
  },
  {
    id: "times",
    label: "Times New Roman",
    stack: '"Times New Roman", serif',
  },
  {
    id: "consolas",
    label: "Consolas",
    stack: "Consolas, monospace",
  },
  {
    id: "courier",
    label: "Courier New",
    stack: '"Courier New", monospace',
  },
  {
    id: "inter",
    label: "Inter",
    stack: '"Inter", "Segoe UI", sans-serif',
  },
  {
    id: "system",
    label: "System UI",
    stack: "system-ui, sans-serif",
  },
  {
    id: "jetbrains",
    label: "JetBrains Mono",
    stack: '"JetBrains Mono", Consolas, monospace',
  },
] as const;

export type FontFamilyId = (typeof FONT_OPTIONS)[number]["id"];

export interface AppearanceSettings {
  fontFamily: FontFamilyId;
  fontSizePx: number;
  zoomPercent: number;
}

export const DEFAULT_APPEARANCE: AppearanceSettings = {
  fontFamily: "segoe",
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

/** Write the saved look onto the page so the whole window scales together. */
export function applyAppearance(settings: AppearanceSettings): void {
  const root = document.documentElement;
  const font = fontStackFor(settings.fontFamily);
  root.style.setProperty("--font-sans", font);
  root.style.setProperty("--font-mono", font);
  root.style.setProperty("--app-font", font);
  root.style.fontFamily = font;
  root.style.fontSize = `${settings.fontSizePx}px`;
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
