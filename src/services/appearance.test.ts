import { beforeEach, describe, expect, it, vi } from "vitest";

const { execute, setZoom } = vi.hoisted(() => ({
  execute: vi.fn(async (_query: string, _bindValues?: unknown[]) => ({
    rowsAffected: 1,
  })),
  setZoom: vi.fn(async (_factor: number) => undefined),
}));

vi.mock("@tauri-apps/api/webview", () => ({
  getCurrentWebview: () => ({ setZoom }),
}));

vi.mock("./database", () => ({
  getDatabase: async () => ({ execute }),
}));

import {
  DEFAULT_APPEARANCE,
  applyAppearance,
  clampNumber,
  commitAppearanceChange,
  fontStackFor,
  getAppliedAppearance,
  normalizeAppearanceSettings,
} from "./appearance";

describe("normalizeAppearanceSettings", () => {
  it("returns defaults for an empty row set", () => {
    expect(normalizeAppearanceSettings({})).toEqual(DEFAULT_APPEARANCE);
  });

  it("clamps out-of-range font size and zoom", () => {
    expect(
      normalizeAppearanceSettings({
        fontFamily: "inter",
        fontSizePx: "99",
        zoomPercent: "10",
      }),
    ).toEqual({
      fontFamily: "inter",
      fontSizePx: 18,
      zoomPercent: 80,
    });
  });

  it("rejects non-numeric size and zoom", () => {
    expect(
      normalizeAppearanceSettings({
        fontFamily: "inter",
        fontSizePx: "nope",
        zoomPercent: "",
      }),
    ).toEqual(DEFAULT_APPEARANCE);
  });

  it("falls back when font id is unknown", () => {
    expect(
      normalizeAppearanceSettings({
        fontFamily: "georgia",
        fontSizePx: "14",
        zoomPercent: "100",
      }),
    ).toEqual({
      fontFamily: "inter",
      fontSizePx: 14,
      zoomPercent: 100,
    });
  });
});

describe("clampNumber", () => {
  it("keeps values inside the range", () => {
    expect(clampNumber(15, 12, 18)).toBe(15);
  });

  it("clamps below min and above max", () => {
    expect(clampNumber(8, 12, 18)).toBe(12);
    expect(clampNumber(20, 12, 18)).toBe(18);
  });
});

describe("fontStackFor", () => {
  it("returns the stack for Inter", () => {
    expect(fontStackFor("inter")).toContain("Inter");
  });

  it("returns the stack for JetBrains Mono", () => {
    expect(fontStackFor("jetbrains")).toContain("JetBrains Mono");
  });
});

describe("commitAppearanceChange", () => {
  beforeEach(() => {
    execute.mockReset();
    execute.mockResolvedValue({ rowsAffected: 1 });
    setZoom.mockReset();
    setZoom.mockResolvedValue(undefined);
    applyAppearance(DEFAULT_APPEARANCE);
  });

  it("writes a second edit only after the first snapshot finishes", async () => {
    const calls: unknown[][] = [];
    let releaseFirstWrite = () => {};
    const firstWrite = new Promise<void>((resolve) => {
      releaseFirstWrite = resolve;
    });
    execute.mockImplementation(
      async (_query: string, bindValues?: unknown[]) => {
        calls.push(bindValues ?? []);
        if (calls.length === 1) await firstWrite;
        return { rowsAffected: 3 };
      },
    );

    const first = commitAppearanceChange({ fontFamily: "jetbrains" });
    const second = commitAppearanceChange({ fontSizePx: 14 });

    await vi.waitFor(() => {
      expect(execute).toHaveBeenCalledTimes(1);
    });
    expect(calls).toEqual([
      ["fontFamily", "jetbrains", "fontSizePx", "16", "zoomPercent", "100"],
    ]);

    releaseFirstWrite();
    await expect(first.saved).resolves.toBe("saved");
    await expect(second.saved).resolves.toBe("saved");
    expect(calls).toEqual([
      ["fontFamily", "jetbrains", "fontSizePx", "16", "zoomPercent", "100"],
      ["fontFamily", "jetbrains", "fontSizePx", "14", "zoomPercent", "100"],
    ]);
    expect(getAppliedAppearance()).toEqual({
      fontFamily: "jetbrains",
      fontSizePx: 14,
      zoomPercent: 100,
    });
  });

  it("keeps a newer edit when an older save fails", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    let calls = 0;
    execute.mockImplementation(async () => {
      calls += 1;
      if (calls === 1) throw new Error("disk full");
      return { rowsAffected: 1 };
    });

    const first = commitAppearanceChange({ fontFamily: "jetbrains" });
    const second = commitAppearanceChange({ fontSizePx: 14 });

    await expect(first.saved).resolves.toBe("failed-superseded");
    await expect(second.saved).resolves.toBe("saved");
    expect(getAppliedAppearance()).toEqual({
      fontFamily: "jetbrains",
      fontSizePx: 14,
      zoomPercent: 100,
    });
    errorSpy.mockRestore();
  });

  it("restores the previous look when the only save fails", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    execute.mockRejectedValue(new Error("disk full"));

    const change = commitAppearanceChange({ zoomPercent: 120 });
    expect(change.next.zoomPercent).toBe(120);

    await expect(change.saved).resolves.toBe("failed-rolled-back");
    expect(getAppliedAppearance()).toEqual(DEFAULT_APPEARANCE);
    errorSpy.mockRestore();
  });
});
