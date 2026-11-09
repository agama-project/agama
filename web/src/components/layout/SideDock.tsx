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
 * To contact SUSE LLC about this file by physical or electronic mail, you may
 * find current contact information at www.suse.com.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { clamp } from "radashi";
import { Button, Tooltip } from "@patternfly/react-core";
import ResizeHandle from "~/components/core/ResizeHandle";
import Icon from "~/components/layout/Icon";
import { useElementSize } from "~/hooks/use-element-size";

import type { TranslatedString } from "~/i18n";

/**
 * The narrowest page area that has room for a docked panel beside the page:
 * about what a 1024 pixels wide window leaves once the page area's margins are
 * taken.
 */
const MIN_AREA_WIDTH = 960;
/** The shortest page area worth sharing, as when the terminal takes its part. */
const MIN_AREA_HEIGHT = 320;
/** The narrowest the docked panel gets. */
const MIN_PANEL_WIDTH = 320;

/** What is remembered of a page's dock: whether docked, and how wide. */
type Remembered = { isDocked: boolean; width?: number };

const NOT_DOCKED: Remembered = { isDocked: false };
const remembered = new Map<string, Remembered>();
const listeners = new Set<() => void>();

const storageKey = (page: string) => `agama.sideDock.${page}`;

/**
 * What a page's dock was left like, kept for the session: a reload keeps it,
 * and a new session starts with nothing docked. Without session storage it
 * still lasts until the reload.
 */
function recall(page: string): Remembered {
  const known = remembered.get(page);
  if (known) return known;

  let found = NOT_DOCKED;
  try {
    const stored = JSON.parse(sessionStorage.getItem(storageKey(page)) ?? "null");
    if (typeof stored?.isDocked === "boolean") found = stored;
  } catch {
    /* Nothing kept, or nothing readable: start undocked. */
  }
  remembered.set(page, found);
  return found;
}

function remember(page: string, changes: Partial<Remembered>) {
  const next = { ...recall(page), ...changes };
  remembered.set(page, next);
  try {
    sessionStorage.setItem(storageKey(page), JSON.stringify(next));
  } catch {
    /* Kept in memory only. */
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function useRemembered(page: string) {
  return useSyncExternalStore(subscribe, () => recall(page));
}

/**
 * Whether the given page has its panel docked, and the way to change it, for
 * whatever offers to dock it. The same page name as given to its
 * {@link SideDock}.
 */
export function useSideDock(page: string) {
  const { isDocked } = useRemembered(page);
  const setDocked = useCallback((value: boolean) => remember(page, { isDocked: value }), [page]);
  return { isDocked, setDocked };
}

/**
 * How the panel is named, which is the name of its landmark. Exactly one of the
 * two is given, and only that one reaches the page:
 *
 * - `labelledBy`, the id of a visible heading inside the panel, when that
 *   heading makes sense on its own, also read out of context in a landmarks
 *   list.
 * - `label`, a name of its own, when the visible heading leans on the page
 *   beside it, as a short "Result" does next to the page it belongs to. The
 *   name should then start with, or contain, the heading's words, so what is
 *   heard matches what is seen.
 *
 * Why never both: when an element has both attributes, `aria-labelledby` wins
 * and `aria-label` is ignored, so a label given next to it would silently never
 * be heard. Rendering only the one given keeps the name the page asked for.
 *
 * @see https://www.w3.org/TR/accname-1.2/#computation-steps
 */
type SideDockName =
  | {
      /** The panel's name, when its visible heading says too little alone. */
      label: TranslatedString;
      labelledBy?: never;
    }
  | {
      /** The id of the visible heading inside the panel that names it. */
      labelledBy: string;
      label?: never;
    };

/** Everything that sets up the dock, except the page it is docked beside. */
export type SideDockSetup = SideDockName & {
  /**
   * Which page the dock belongs to, such as "storage". Whether its panel is
   * docked, and how wide, is remembered under it for the session, apart from
   * any other page's.
   */
  page: string;
  /**
   * The id of the panel, so a control showing or hiding it can point at it
   * with `aria-controls`. The panel is always in the page, docked or not.
   */
  panelId: string;
  /** What the resize handle says it resizes, such as "Resize the preview". */
  resizeLabel: TranslatedString;
  /** What the docked panel holds. Rendered only while the panel is in sight. */
  panel: React.ReactNode;
};

export type SideDockProps = SideDockSetup & {
  /** The page the panel is docked beside. */
  children: React.ReactNode;
};

/** What the content of a dock knows about it. */
type DockState = {
  /** Whether the panel is in sight. */
  isShown: boolean;
  /** Whether the page area has room to dock the panel. */
  isOffered: boolean;
  /** Whether the panel is docked, in sight or put away for lack of room. */
  isDocked: boolean;
  panelId: string;
  setDocked: (value: boolean) => void;
  /** The toggle, where the focus goes back when the panel closes itself. */
  toggleRef: React.MutableRefObject<HTMLButtonElement | null>;
};

const DockContext = createContext<DockState | null>(null);

/**
 * Whether the docked panel is in sight, for content that moves into it rather
 * than appearing twice. False when the panel is not docked, and also while
 * the page area has no room for it.
 */
export function useIsSideDockShown() {
  return useContext(DockContext)?.isShown ?? false;
}

/**
 * A way to dock the panel from elsewhere in the page, such as from a popup
 * showing the same content: undefined while the page area has no room for it,
 * so whatever offers it is not rendered. Docking moves the focus to the
 * panel's heading.
 */
export function useDockPanel(): (() => void) | undefined {
  const dock = useContext(DockContext);
  if (!dock?.isOffered) return undefined;
  return () => dock.setDocked(true);
}

export type SideDockToggleProps = {
  /**
   * The button's name, saying what it docks rather than what it does, since
   * pressed or not says the rest: "Result preview beside the page", not "Show
   * the result preview". Also shown in its tooltip.
   */
  label: TranslatedString;
};

/**
 * The button docking the panel beside the page, or putting it away: a toggle
 * button, pressed while the panel is docked. Only an icon, so its name is
 * also shown in a tooltip, on hover and on focus.
 *
 * Placed anywhere in the page of a {@link SideDock}. Docking moves the focus to
 * the panel's heading, so a keyboard or screen reader user lands on what just
 * appeared; putting the panel away brings the focus back to the toggle. Where
 * the toggle sits in content that moves into the panel, it is out of sight
 * while docked: the panel then needs a {@link SideDockClose} to be put away.
 * Not rendered while the page area has no room for the panel, since it would
 * do nothing visible.
 *
 * @see https://www.w3.org/WAI/ARIA/apg/patterns/button/
 */
export function SideDockToggle({ label }: SideDockToggleProps) {
  const dock = useContext(DockContext);
  if (!dock?.isOffered) return null;

  const { isDocked, panelId, setDocked, toggleRef } = dock;

  return (
    /* The tooltip repeats the name for sighted users; screen readers already
       have it, so it is not tied to the button as its description too. */
    <Tooltip content={label} aria="none">
      <Button
        ref={toggleRef}
        variant="plain"
        aria-label={label}
        aria-pressed={isDocked}
        aria-controls={panelId}
        icon={<Icon name={isDocked ? "right_panel_close" : "right_panel_open"} />}
        onClick={() => setDocked(!isDocked)}
      />
    </Tooltip>
  );
}

export type SideDockCloseProps = {
  /** The button's name, such as "Close the result preview". Also its tooltip. */
  label: TranslatedString;
};

/**
 * The button putting the docked panel away from inside it, for whoever is
 * reading the panel rather than the page. Meant for the panel's heading row.
 * Its icon is the toggle's pressed one, the reverse of the one docking it, so
 * the two read as a pair rather than as a dismissal.
 *
 * The focus goes back to the toggle that docks the panel, so the reader is
 * where the panel can be docked again; to the page, if there is no toggle.
 *
 * Escape does not close the panel: it is not a dialog, the page stays in use
 * beside it, and Escape belongs to whatever the page opens over itself.
 */
export function SideDockClose({ label }: SideDockCloseProps) {
  const dock = useContext(DockContext);
  if (!dock) return null;

  return (
    <Tooltip content={label} aria="none">
      <Button
        variant="plain"
        aria-label={label}
        icon={<Icon name="right_panel_close" />}
        onClick={() => dock.setDocked(false)}
      />
    </Tooltip>
  );
}

/** Moves the focus into a panel just docked: to its first heading, or to it. */
function focusInto(panel: HTMLElement) {
  const target = panel.querySelector<HTMLElement>("h1, h2, h3, h4, h5, h6") ?? panel;
  if (!target.hasAttribute("tabindex")) target.tabIndex = -1;
  target.focus();
}

/**
 * A page with a panel docked beside it, at the end of the line of text (on the
 * right in left-to-right languages), along the whole height of the page area.
 * The reader moves the line between them to share the width, with the pointer
 * or the keyboard.
 *
 * The panel is complementary content, not a dialog: it does not hold the focus
 * or block the page, and both stay in use side by side. It is a named landmark,
 * reached from the landmarks list, and comes after the page in the Tab order.
 *
 * When to use it: only on a page whose content adapts to the width it is
 * given, or has nothing that needs to. The docked panel narrows the page, but
 * most PatternFly layouts follow the width of the window, so a page built for
 * the window would be laid out for room it no longer has. Regular tables follow
 * their container, and so do Agama's tree tables; toolbars, forms and layouts
 * with breakpoints may not. Check the page at its narrowest before docking
 * anything beside it.
 *
 * Why not a drawer: a page may already open a drawer of its own, such as a
 * panel with the details of an item. That drawer stays inside the page,
 * covering only the page, and the docked panel stays in sight beside it. A
 * drawer docked around another drawer would need twice the work to scroll with
 * the page, and would put two splitters that answer the keys differently on
 * one screen.
 *
 * Sharing the screen with the terminal: the terminal docks at the bottom of
 * the whole window and keeps the full width; this panel lives in the page area
 * above it. It measures the room it is given rather than the window, so a tall
 * terminal makes it shorter. When the page area is too narrow or too short to
 * share, the panel is put away, docked or not, and the page has the whole area
 * again; whatever offers to dock the panel should not be offered meanwhile.
 *
 * @see https://www.w3.org/WAI/ARIA/apg/patterns/windowsplitter/
 */
export default function SideDock({
  page,
  panelId,
  label,
  labelledBy,
  resizeLabel,
  panel,
  children,
}: SideDockProps) {
  const [area, setArea] = useState<HTMLDivElement | null>(null);
  const { width: areaWidth = 0, height: areaHeight = 0 } = useElementSize(area);
  const { isDocked, width } = useRemembered(page);
  const setWidth = useCallback((value: number) => remember(page, { width: value }), [page]);
  const panelRef = useRef<HTMLElement>(null);
  const isFocusWanted = useRef(false);
  const toggleRef = useRef<HTMLButtonElement | null>(null);

  const setDocked = useCallback(
    (value: boolean) => {
      isFocusWanted.current = true;
      remember(page, { isDocked: value });
    },
    [page],
  );

  const hasRoom = areaWidth >= MIN_AREA_WIDTH && areaHeight >= MIN_AREA_HEIGHT;
  const isShown = isDocked && hasRoom;
  const maxWidth = Math.max(MIN_PANEL_WIDTH, areaWidth / 2);
  const panelWidth = clamp(width ?? areaWidth / 3, MIN_PANEL_WIDTH, maxWidth);

  /* Once the change is on the screen, not before: a hidden panel cannot take
     the focus, and a toggle in content leaving the panel is not back yet. */
  useEffect(() => {
    if (!isFocusWanted.current) return;
    isFocusWanted.current = false;

    if (isShown) {
      if (panelRef.current) focusInto(panelRef.current);
      return;
    }
    const page = document.getElementById(`${panelId}-page`);
    (toggleRef.current ?? page)?.focus();
  }, [isShown, panelId]);

  const resizeToPointer = useCallback(
    (clientX: number) => {
      if (!area) return;

      const box = area.getBoundingClientRect();
      const isRTL = getComputedStyle(area).direction === "rtl";
      const next = isRTL ? clientX - box.left : box.right - clientX;
      setWidth(clamp(next, MIN_PANEL_WIDTH, maxWidth));
    },
    [area, maxWidth, setWidth],
  );

  return (
    <DockContext.Provider
      value={{ isShown, isOffered: hasRoom, isDocked, panelId, setDocked, toggleRef }}
    >
      <div ref={setArea} className="agm-side-dock">
        {/* Focusable from scripts only, to take the focus back when the panel
            closes and nothing else can. */}
        <div id={`${panelId}-page`} tabIndex={-1} className="agm-side-dock__page">
          {children}
        </div>
        {isShown && (
          <ResizeHandle
            panelAt="end"
            controls={panelId}
            size={panelWidth}
            min={MIN_PANEL_WIDTH}
            max={maxWidth}
            onResize={setWidth}
            onDrag={resizeToPointer}
            label={resizeLabel}
          />
        )}
        <aside
          ref={panelRef}
          id={panelId}
          aria-label={label}
          aria-labelledby={label ? undefined : labelledBy}
          className="agm-side-dock__panel"
          hidden={!isShown}
          style={{ inlineSize: panelWidth }}
        >
          {/* Always there for the toggle to point at, but filled only while in
              sight: what it holds may be costly, and is out of date by the
              time it is docked again. */}
          {isShown && panel}
        </aside>
      </div>
    </DockContext.Provider>
  );
}
