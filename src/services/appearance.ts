/**
 * Saved look of the app: font, size, and zoom.
 * Stored in the local SQLite database so it survives a restart.
 */

import { getCurrentWebview } from "@tauri-apps/api/webview";
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

export const FONT_SIZE_MIN = 12;
export const FONT_SIZE_MAX = 18;
export const ZOOM_MIN = 80;
export const ZOOM_MAX = 150;

export const FONT_SIZE_PX_OPTIONS = Array.from(
  { length: FONT_SIZE_MAX - FONT_SIZE_MIN + 1 },
  (_, index) => FONT_SIZE_MIN + index,
);

export const ZOOM_PERCENT_OPTIONS = Array.from(
  { length: (ZOOM_MAX - ZOOM_MIN) / 10 + 1 },
  (_, index) => ZOOM_MIN + index * 10,
);

const CACHE_KEY = "waterfowl.appearance.v1";

const KEYS = {
  fontFamily: "fontFamily",
  fontSizePx: "fontSizePx",
  zoomPercent: "zoomPercent",
} as const;

let appearanceDirtySinceLoad = false;
let applied: AppearanceSettings | null = null;
let saveQueue: Promise<void> = Promise.resolve();
let zoomQueue: Promise<void> = Promise.resolve();

export type AppearanceSaveOutcome =
  | "saved"
  | "failed-rolled-back"
  | "failed-superseded";

export function markAppearanceDirty(): void {
  appearanceDirtySinceLoad = true;
}

export function shouldApplyLoadedAppearance(): boolean {
  return !appearanceDirtySinceLoad;
}

function isFontFamilyId(value: string): value is FontFamilyId {
  return FONT_OPTIONS.some((option) => option.id === value);
}

export function clampNumber(value: number, min: number, max: number): number {
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

/** The look currently on screen. Startup, database load, and edits all update it. */
export function getAppliedAppearance(): AppearanceSettings {
  return applied ?? readCachedAppearance() ?? DEFAULT_APPEARANCE;
}

function enqueueZoom(zoomPercent: number): void {
  const factor = zoomPercent / 100;
  const job = zoomQueue.then(async () => {
    try {
      await getCurrentWebview().setZoom(factor);
    } catch (error: unknown) {
      console.error("Failed to set window zoom", error);
    }
  });
  zoomQueue = job.then(
    () => undefined,
    () => undefined,
  );
}

/** Write the saved look onto the page so the whole window scales together. */
export function applyAppearance(settings: AppearanceSettings): void {
  applied = settings;
  if (typeof document !== "undefined") {
    const root = document.documentElement;
    const font = fontStackFor(settings.fontFamily);
    root.style.setProperty("--font-sans", font);
    root.style.fontFamily = font;
    // Keep 1rem at 16px so icon boxes and spacing stay put.
    root.style.fontSize = "16px";
    const scale = settings.fontSizePx / 16;
    for (const [token, size] of Object.entries(TEXT_SCALE)) {
      root.style.setProperty(token, `${size * scale}rem`);
    }
  }
  enqueueZoom(settings.zoomPercent);
}

function enqueueSave(
  snapshot: AppearanceSettings,
  restoreTo: AppearanceSettings,
): Promise<AppearanceSaveOutcome> {
  const job = saveQueue.then(async (): Promise<AppearanceSaveOutcome> => {
    try {
      await saveAppearance(snapshot);
      return "saved";
    } catch (error: unknown) {
      console.error("Failed to save appearance settings", error);
      if (applied === snapshot) {
        applyAppearance(restoreTo);
        writeCachedAppearance(restoreTo);
        return "failed-rolled-back";
      }
      return "failed-superseded";
    }
  });
  saveQueue = job.then(
    () => undefined,
    () => undefined,
  );
  return job;
}

/**
 * Apply one settings change immediately, then save the full snapshot.
 * Saves run one at a time so two edits cannot mix font, size, and zoom.
 */
export function commitAppearanceChange(patch: Partial<AppearanceSettings>): {
  next: AppearanceSettings;
  saved: Promise<AppearanceSaveOutcome>;
} {
  const base = applied ?? readCachedAppearance() ?? DEFAULT_APPEARANCE;
  const next = mergeAppearanceSettings(base, patch);
  markAppearanceDirty();
  applyAppearance(next);
  writeCachedAppearance(next);
  return { next, saved: enqueueSave(next, base) };
}

export function normalizeAppearanceSettings(
  raw: Partial<Record<string, string>>,
): AppearanceSettings {
  const fontFamily =
    raw.fontFamily && isFontFamilyId(raw.fontFamily)
      ? raw.fontFamily
      : DEFAULT_APPEARANCE.fontFamily;

  return {
    fontFamily,
    fontSizePx: parseBoundedInt(
      raw.fontSizePx,
      FONT_SIZE_MIN,
      FONT_SIZE_MAX,
      DEFAULT_APPEARANCE.fontSizePx,
    ),
    zoomPercent: parseBoundedInt(
      raw.zoomPercent,
      ZOOM_MIN,
      ZOOM_MAX,
      DEFAULT_APPEARANCE.zoomPercent,
    ),
  };
}

function parseBoundedInt(
  raw: string | undefined,
  min: number,
  max: number,
  fallback: number,
): number {
  if (raw === undefined || raw.trim() === "") {
    return fallback;
  }
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return clampNumber(value, min, max);
}

export function mergeAppearanceSettings(
  base: AppearanceSettings,
  patch: Partial<AppearanceSettings>,
): AppearanceSettings {
  return normalizeAppearanceSettings({
    fontFamily: patch.fontFamily ?? base.fontFamily,
    fontSizePx: String(patch.fontSizePx ?? base.fontSizePx),
    zoomPercent: String(patch.zoomPercent ?? base.zoomPercent),
  });
}

export function readCachedAppearance(): AppearanceSettings | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AppearanceSettings>;
    return normalizeAppearanceSettings({
      fontFamily: String(parsed.fontFamily ?? ""),
      fontSizePx: String(parsed.fontSizePx ?? ""),
      zoomPercent: String(parsed.zoomPercent ?? ""),
    });
  } catch {
    return null;
  }
}

export function writeCachedAppearance(settings: AppearanceSettings): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(settings));
  } catch (error: unknown) {
    console.error("Failed to cache appearance settings", error);
  }
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
  return normalizeAppearanceSettings(raw);
}

export async function saveAppearance(
  settings: AppearanceSettings,
): Promise<void> {
  const safe = normalizeAppearanceSettings({
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
