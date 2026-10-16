import { useEffect, type ReactNode } from "react";
import {
  applyAppearance,
  getAppearance,
  shouldApplyLoadedAppearance,
  writeCachedAppearance,
} from "@services/appearance";

/** Load saved appearance from SQLite after startup (localStorage paints first). */
export function AppearanceBootstrap({ children }: { children: ReactNode }) {
  useEffect(() => {
    let cancelled = false;

    getAppearance()
      .then((saved) => {
        if (cancelled || !shouldApplyLoadedAppearance()) return;
        applyAppearance(saved);
        writeCachedAppearance(saved);
      })
      .catch((error: unknown) => {
        console.error("Failed to load appearance settings", error);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return children;
}
