/*
 * Copyright (c) [2026] SUSE LLC
 *
 * All Rights Reserved.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of the GNU General Public License as published by the Free
 * Software Foundation; either version 2 of the License, or (at your option)
 * any later version.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
 * FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for
 * more details.
 *
 * You should have received a copy of the GNU General Public License along
 * with this program; if not, contact SUSE LLC.
 *
 * To contact SUSE LLC about this file by physical or electronic mail, you may
 * find current contact information at www.suse.com.
 */

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import usePersistedState from "~/hooks/use-persisted-state";

/**
 * Color scheme axis. "system" follows the OS preference.
 */
export type ColorScheme = "system" | "light" | "dark";

/**
 * Contrast axis. Composes on top of any color scheme. "system" follows the OS
 * preference.
 */
export type Contrast = "system" | "standard" | "high";

/**
 * localStorage keys. Kept in sync with the flash-prevention script in
 * index.html, which reads them before React boots to avoid a theme flash.
 */
export const COLOR_SCHEME_KEY = "agm-color-scheme";
export const CONTRAST_KEY = "agm-contrast";

const DARK_CLASS = "pf-v6-theme-dark";
const HIGH_CONTRAST_CLASS = "pf-v6-theme-high-contrast";
const PREFERS_DARK = "(prefers-color-scheme: dark)";
const PREFERS_CONTRAST = "(prefers-contrast: more)";

type AppearanceContextValue = {
  colorScheme: ColorScheme;
  setColorScheme: (value: ColorScheme) => void;
  contrast: Contrast;
  setContrast: (value: Contrast) => void;
  /** Whether dark is currently active (resolves "system" against the OS). */
  isDark: boolean;
};

const AppearanceContext = createContext<AppearanceContextValue | undefined>(undefined);

/**
 * Resolves whether dark should be active for the given color scheme, taking the
 * OS preference into account when following the system.
 */
function resolveDark(colorScheme: ColorScheme): boolean {
  if (colorScheme === "dark") return true;
  if (colorScheme === "light") return false;
  return window.matchMedia(PREFERS_DARK).matches;
}

/**
 * Resolves whether high contrast should be active, taking the OS preference
 * into account when following the system.
 */
function isHighContrast(contrast: Contrast): boolean {
  if (contrast === "high") return true;
  if (contrast === "standard") return false;
  return window.matchMedia(PREFERS_CONTRAST).matches;
}

/**
 * Applies the theme to the document root by toggling PatternFly's theme classes
 * and the native color-scheme hint (for UA-rendered controls and scrollbars).
 */
function applyTheme(colorScheme: ColorScheme, contrast: Contrast): void {
  const root = document.documentElement;
  root.classList.toggle(DARK_CLASS, resolveDark(colorScheme));
  root.classList.toggle(HIGH_CONTRAST_CLASS, isHighContrast(contrast));
  root.style.colorScheme = colorScheme === "system" ? "light dark" : colorScheme;
}

/**
 * Provides the active appearance and setters, and keeps the document root in sync.
 *
 * Appearance has two independent axes: a color scheme (System/Light/Dark) and a
 * contrast level (System/Standard/High). Both persist per-browser. When
 * following the system, each axis re-evaluates as the OS preference changes.
 *
 * The initial paint is handled by the flash-prevention script in index.html;
 * this provider takes over once React mounts and on every later change.
 */
export function AppearanceProvider({ children }: React.PropsWithChildren): React.ReactNode {
  const [colorScheme, setColorScheme] = usePersistedState<ColorScheme>(COLOR_SCHEME_KEY, "system");
  const [contrast, setContrast] = usePersistedState<Contrast>(CONTRAST_KEY, "system");
  const [isDark, setIsDark] = useState<boolean>(() => resolveDark(colorScheme));

  // Applies the current appearance to the document root and exposes the
  // resolved dark state. Stable across renders for the chosen axes.
  const apply = useCallback(() => {
    applyTheme(colorScheme, contrast);
    setIsDark(resolveDark(colorScheme));
  }, [colorScheme, contrast]);

  useEffect(() => {
    apply();
  }, [apply]);

  // Re-apply when an OS preference changes, but only for the axes following it.
  useEffect(() => {
    const queries: MediaQueryList[] = [];

    if (colorScheme === "system") queries.push(window.matchMedia(PREFERS_DARK));
    if (contrast === "system") queries.push(window.matchMedia(PREFERS_CONTRAST));
    queries.forEach((query) => query.addEventListener("change", apply));

    return () => queries.forEach((query) => query.removeEventListener("change", apply));
  }, [apply, colorScheme, contrast]);

  return (
    <AppearanceContext.Provider
      value={{ colorScheme, setColorScheme, contrast, setContrast, isDark }}
    >
      {children}
    </AppearanceContext.Provider>
  );
}

/**
 * Reads the active appearance and its setters. Must be used within an
 * AppearanceProvider.
 */
export function useAppearance(): AppearanceContextValue {
  const context = useContext(AppearanceContext);
  if (context === undefined) {
    throw new Error("useAppearance must be used within an AppearanceProvider");
  }
  return context;
}
