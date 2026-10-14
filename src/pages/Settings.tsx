import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown, Palette } from "lucide-react";
import { FONT_OPTIONS } from "@services/appearance";
import { useAppearance } from "@context/AppearanceContext";
import styles from "./Settings.module.css";

const FONT_SIZES = [12, 13, 14, 15, 16, 17, 18];
const ZOOMS = [80, 90, 100, 110, 120, 130, 140, 150];

function SettingSelect<T extends string | number>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const selected = options.find((option) => option.value === value);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className={styles.select} ref={rootRef}>
      <button
        type="button"
        className={styles.selectTrigger}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={label}
        onClick={() => setOpen((current) => !current)}
      >
        <span>{selected?.label ?? String(value)}</span>
        <ChevronDown
          size={14}
          className={styles.selectChevron}
          data-open={open}
        />
      </button>
      {open && (
        <ul id={listId} className={styles.selectMenu} role="listbox">
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <li key={String(option.value)} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={styles.selectOption}
                  data-selected={isSelected}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                >
                  <span>{option.label}</span>
                  {isSelected && <Check size={14} />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function Settings() {
  const { settings, updateSettings } = useAppearance();

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Settings</h1>
          <p className={styles.subtitle}>
            Appearance is saved on this computer and restored when the app opens.
          </p>
        </div>
      </header>

      <div className={styles.body}>
        <nav className={styles.nav} aria-label="Settings sections">
          <div className={styles.navItem} aria-current="page">
            <Palette size={16} />
            <span>Appearance</span>
          </div>
        </nav>

        <section className={styles.content}>
          <div className={styles.panel}>
            <div className={styles.row}>
              <div>
                <h3 className={styles.rowTitle}>Font type</h3>
                <p className={styles.rowHint}>Typeface used for the app text.</p>
              </div>
              <SettingSelect
                label="Font type"
                value={settings.fontFamily}
                options={FONT_OPTIONS.map((option) => ({
                  value: option.id,
                  label: option.label,
                }))}
                onChange={(fontFamily) => {
                  void updateSettings({ fontFamily });
                }}
              />
            </div>

            <div className={styles.row}>
              <div>
                <h3 className={styles.rowTitle}>Font size</h3>
                <p className={styles.rowHint}>
                  Base text size. Other sizes scale with it.
                </p>
              </div>
              <SettingSelect
                label="Font size"
                value={settings.fontSizePx}
                options={FONT_SIZES.map((size) => ({
                  value: size,
                  label: `${size}px`,
                }))}
                onChange={(fontSizePx) => {
                  void updateSettings({ fontSizePx });
                }}
              />
            </div>

            <div className={styles.row}>
              <div>
                <h3 className={styles.rowTitle}>Zoom</h3>
                <p className={styles.rowHint}>Scale of the whole window.</p>
              </div>
              <SettingSelect
                label="Zoom"
                value={settings.zoomPercent}
                options={ZOOMS.map((zoom) => ({
                  value: zoom,
                  label: `${zoom}%`,
                }))}
                onChange={(zoomPercent) => {
                  void updateSettings({ zoomPercent });
                }}
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
