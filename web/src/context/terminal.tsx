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
import { isKeyboardActivation } from "~/utils";

/**
 * Id given to the focus stop in front of the shell, the target of the links
 * that jump to the terminal. Shared so that the links and their target cannot
 * drift apart.
 */
export const TERMINAL_STOP_ID = "terminal-stop";

/**
 * Id given to the text explaining how to leave the terminal with the keyboard.
 * The terminal input points at it, so that the explanation is announced to
 * anyone landing on the terminal, not only read by those who can see it.
 */
export const TERMINAL_HINT_ID = "terminal-keyboard-hint";

/**
 * Where the keyboard focus goes when the terminal panel opens: straight into
 * the shell, ready to type, or onto the focus stop in front of it.
 */
type TerminalFocusTarget = "shell" | "stop";

/** How the panel is asked to open. */
type OpenOptions = {
  /**
   * Where to leave the focus, `"shell"` by default. `focusTargetFor` picks it
   * from the event that opened the panel.
   */
  focusTarget?: TerminalFocusTarget;
};

type TerminalContextValue = {
  /**
   * Whether the terminal panel (and its shell session) is open. `open()`
   * creates the session; `close()` ends it. There is no separate "hidden but
   * still connected" state: minimizing is the only way to shrink the panel
   * while keeping the session alive (see {@link isMinimized}).
   */
  isOpen: boolean;
  /** Opens the panel, creating a new session. */
  open: (options?: OpenOptions) => void;
  /** Closes the panel, ending the session. */
  close: () => void;
  /** Toggles between open and closed. */
  toggle: (options?: OpenOptions) => void;
  /**
   * Where the focus was asked to land when the panel was last opened. Only
   * meaningful while it is open; closing it goes back to the default.
   */
  openFocusTarget: TerminalFocusTarget;
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

/**
 * Where to leave the focus when the terminal is opened by `event`.
 *
 * A pointer goes straight into the shell: clicking a terminal open is asking
 * to type in it, and a pointer can always click its way out again. The
 * keyboard stops in front of the shell instead, where the way in and the way
 * back out are spelled out before anything is typed.
 *
 * Shared by every opener so that they cannot disagree on it.
 */
function focusTargetFor(event: { detail: number }): TerminalFocusTarget {
  return isKeyboardActivation(event) ? "stop" : "shell";
}

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
  const [openFocusTarget, setOpenFocusTarget] = useState<TerminalFocusTarget>("shell");

  // Opening always starts expanded, so it never reopens as a collapsed bar
  // after having previously been minimized.
  const open = useCallback(({ focusTarget = "shell" }: OpenOptions = {}) => {
    setIsOpen(true);
    setIsMinimized(false);
    setOpenFocusTarget(focusTarget);
  }, []);
  const close = useCallback(() => {
    setIsOpen(false);
    setIsMinimized(false);
    setOpenFocusTarget("shell");
  }, []);
  const toggle = useCallback(({ focusTarget = "shell" }: OpenOptions = {}) => {
    setIsOpen((wasOpen) => !wasOpen);
    setIsMinimized(false);
    setOpenFocusTarget(focusTarget);
  }, []);
  const minimize = useCallback(() => setIsMinimized(true), []);
  const restore = useCallback(() => setIsMinimized(false), []);

  const value = useMemo(
    () => ({
      isOpen,
      open,
      close,
      toggle,
      openFocusTarget,
      isMinimized,
      minimize,
      restore,
      height,
      setHeight,
    }),
    [isOpen, open, close, toggle, openFocusTarget, isMinimized, minimize, restore, height],
  );

  return <TerminalContext.Provider value={value}>{children}</TerminalContext.Provider>;
}

export { TerminalProvider, useTerminal, focusTargetFor };
