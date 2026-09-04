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

import React, { useCallback, useMemo, useState } from "react";

type TerminalContextValue = {
  /**
   * Whether the terminal panel (and its shell session) is open. `open()`
   * creates the session; `close()` ends it. There is no separate "hidden but
   * still connected" state: minimizing is the only way to shrink the panel
   * while keeping the session alive (see {@link isMinimized}).
   */
  isOpen: boolean;
  /** Opens the panel, creating a new session. */
  open: () => void;
  /** Closes the panel, ending the session. */
  close: () => void;
  /** Toggles between open and closed. */
  toggle: () => void;
  /** Whether the terminal panel is collapsed to its header bar. */
  isMinimized: boolean;
  /** Collapses the terminal panel to its header bar, keeping the session. */
  minimize: () => void;
  /** Expands the terminal panel back to its full size. */
  restore: () => void;
  /**
   * Height of the terminal panel in pixels, or `undefined` to let the layout
   * pick a default. The layout clamps this value to the space available.
   */
  height?: number;
  /** Sets the preferred height of the terminal panel in pixels. */
  setHeight: (height: number) => void;
};

const TerminalContext = React.createContext<TerminalContextValue | undefined>(undefined);

/**
 * Gives access to the terminal panel state (open/closed, minimized, and
 * preferred height).
 *
 * The state lives above the page-swapping route outlet, so the panel survives
 * navigation between pages and reopens right where the user left it.
 */
function useTerminal(): TerminalContextValue {
  const context = React.useContext(TerminalContext);
  if (context === undefined) {
    throw new Error("useTerminal must be used within a TerminalProvider");
  }

  return context;
}

/**
 * Provider for the terminal panel state. See {@link useTerminal}.
 */
function TerminalProvider({ children }: React.PropsWithChildren) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [height, setHeight] = useState<number | undefined>(undefined);

  // Opening always starts expanded, so it never reopens as a collapsed bar
  // after having previously been minimized.
  const open = useCallback(() => {
    setIsOpen(true);
    setIsMinimized(false);
  }, []);
  const close = useCallback(() => {
    setIsOpen(false);
    setIsMinimized(false);
  }, []);
  const toggle = useCallback(() => {
    setIsOpen((wasOpen) => !wasOpen);
    setIsMinimized(false);
  }, []);
  const minimize = useCallback(() => setIsMinimized(true), []);
  const restore = useCallback(() => setIsMinimized(false), []);

  const value = useMemo(
    () => ({
      isOpen,
      open,
      close,
      toggle,
      isMinimized,
      minimize,
      restore,
      height,
      setHeight,
    }),
    [isOpen, open, close, toggle, isMinimized, minimize, restore, height],
  );

  return <TerminalContext.Provider value={value}>{children}</TerminalContext.Provider>;
}

export { TerminalProvider, useTerminal };
