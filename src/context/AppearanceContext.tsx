import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  applyAppearance,
  DEFAULT_APPEARANCE,
  getAppearance,
  saveAppearance,
  type AppearanceSettings,
} from "@services/appearance";

interface AppearanceContextValue {
  settings: AppearanceSettings;
  updateSettings: (patch: Partial<AppearanceSettings>) => Promise<void>;
}

const AppearanceContext = createContext<AppearanceContextValue | null>(null);

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppearanceSettings>(DEFAULT_APPEARANCE);

  useEffect(() => {
    let cancelled = false;
    getAppearance()
      .then((saved) => {
        if (cancelled) return;
        setSettings(saved);
        applyAppearance(saved);
      })
      .catch((error: unknown) => {
        console.error("Failed to load appearance settings", error);
        applyAppearance(DEFAULT_APPEARANCE);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const updateSettings = useCallback(async (patch: Partial<AppearanceSettings>) => {
    const next = { ...settings, ...patch };
    applyAppearance(next);
    setSettings(next);
    await saveAppearance(next);
  }, [settings]);

  const value = useMemo(
    () => ({ settings, updateSettings }),
    [settings, updateSettings],
  );

  return (
    <AppearanceContext.Provider value={value}>
      {children}
    </AppearanceContext.Provider>
  );
}

export function useAppearance(): AppearanceContextValue {
  const context = useContext(AppearanceContext);
  if (!context) {
    throw new Error("useAppearance must be used inside AppearanceProvider");
  }
  return context;
}
