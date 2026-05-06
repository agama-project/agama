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

import { useEffect, useRef, useState } from "react";

/**
 * Selectors for finding focusable items in PatternFly dropdown components.
 */
const SELECTORS = {
  /** Selector for PatternFly Select component (SelectOption items). */
  select: "li button:not(:disabled), li input:not(:disabled)",
  /** Selector for PatternFly Menu component (MenuItem items). */
  menu: "li button:not(:disabled)",
} as const;

type Component = keyof typeof SELECTORS;

/**
 * Options for the {@link useSelectKeyboard} hook.
 */
type UseSelectKeyboardOptions = {
  /**
   * Type of PatternFly component.
   * - "select": PatternFly Select component (default)
   * - "menu": PatternFly Menu component
   */
  component?: Component;
  /**
   * External isOpen state. If provided, the hook will not manage internal state.
   * Use this when the component already manages its own open/close state.
   */
  isOpen?: boolean;
  /**
   * External setIsOpen function. Required when isOpen is provided.
   */
  setIsOpen?: (isOpen: boolean) => void;
};

/**
 * Return value of the {@link useSelectKeyboard} hook.
 */
type UseSelectKeyboardReturn = {
  /** Whether the menu is currently open. */
  isOpen: boolean;
  /** Function to programmatically open or close the menu. */
  setIsOpen: (isOpen: boolean) => void;
  /** Ref to attach to the PatternFly component (forwards to underlying Menu). */
  menuRef: React.RefObject<HTMLDivElement>;
  /** Keyboard event handler to attach to the component's onToggleKeydown or onKeyDown prop. */
  onToggleKeydown: (event: React.KeyboardEvent | KeyboardEvent) => void;
};

/**
 * Hook for W3C-compliant keyboard navigation in PatternFly dropdown components.
 *
 * Implements arrow-key-to-open behavior for dropdown menus. For Select components,
 * this follows the W3C ARIA Authoring Practices Guide (APG) Select-Only Combobox
 * pattern, which allows arrow keys to open the menu when closed while maintaining
 * the explore-then-commit interaction.
 *
 * ## Why this pattern exists
 *
 * **For sighted users:** Lets users explore options without triggering unwanted
 * changes. In reactive forms where selections control field visibility, users can
 * read all option descriptions before causing the form to reconfigure.
 *
 * **For screen reader users:** Prevents accidental value changes while exploring
 * options. Users can hear all descriptions before committing, rather than changing
 * the value with each arrow press.
 *
 * **Arrow keys open the menu but don't commit** - users must press Enter/Space
 * to confirm their choice (for Select) or click an action (for Menu). This is
 * faster than requiring Enter/Space to open while remaining safer.
 *
 * @remarks
 * The hook provides a keyboard handler that:
 * - Opens the menu and focuses the first item when ↓ is pressed on a closed toggle
 * - Opens the menu and focuses the last item when ↑ is pressed on a closed toggle
 * - Delegates to PatternFly's default arrow navigation when the menu is already open
 *
 * Can optionally manage internal state or work with external state management.
 *
 * @example Basic usage (internal state)
 * ```tsx
 * const { isOpen, setIsOpen, menuRef, onToggleKeydown } = useSelectKeyboard();
 *
 * <Select
 *   ref={menuRef}
 *   isOpen={isOpen}
 *   onOpenChange={setIsOpen}
 *   onToggleKeydown={onToggleKeydown}
 *   toggle={...}
 * >
 *   <SelectList>...</SelectList>
 * </Select>
 * ```
 *
 * @example With external state
 * ```tsx
 * const [isOpen, setIsOpen] = useState(false);
 * const { menuRef, onToggleKeydown } = useSelectKeyboard({
 *   component: "menu",
 *   isOpen,
 *   setIsOpen
 * });
 *
 * <Menu ref={menuRef} onKeyDown={onToggleKeydown} ...>
 *   <MenuList>...</MenuList>
 * </Menu>
 * ```
 *
 * @see https://www.w3.org/WAI/ARIA/apg/patterns/combobox/examples/combobox-select-only/
 */
export const useSelectKeyboard = (
  options: UseSelectKeyboardOptions = {},
): UseSelectKeyboardReturn => {
  const { component = "select", isOpen: externalIsOpen, setIsOpen: externalSetIsOpen } = options;

  const menuRef = useRef<HTMLDivElement>(null);
  const openedWithArrowUp = useRef(false);
  const prevIsOpen = useRef(false);

  // Use internal state if external state not provided
  const [internalIsOpen, internalSetIsOpen] = useState(false);
  const isOpen = externalIsOpen ?? internalIsOpen;
  const setIsOpen = externalSetIsOpen ?? internalSetIsOpen;

  // Get selector based on component type
  const selector = SELECTORS[component];

  useEffect(() => {
    // When menu opens, focus first or last item based on which arrow key triggered it.
    // Pattern borrowed from PatternFly's shouldFocusFirstItemOnOpen implementation:
    // https://github.com/patternfly/patternfly-react/blob/main/packages/react-core/src/components/Select/Select.tsx
    if (prevIsOpen.current === false && isOpen === true) {
      setTimeout(() => {
        const items = menuRef.current?.querySelectorAll<HTMLElement>(selector);
        if (items?.length) {
          const target = openedWithArrowUp.current ? items[items.length - 1] : items[0];
          target.focus({ preventScroll: true });
        }
        openedWithArrowUp.current = false;
      }, 0);
    }
    prevIsOpen.current = isOpen;
  }, [isOpen, selector]);

  const onToggleKeydown = (event: React.KeyboardEvent | KeyboardEvent) => {
    // Only handle arrow keys when menu is closed (to open it and focus first/last item).
    // When menu is open, PatternFly handles arrow navigation naturally.
    if (!isOpen && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      event.preventDefault();
      openedWithArrowUp.current = event.key === "ArrowUp";
      setIsOpen(true);
    }
  };

  return { isOpen, setIsOpen, menuRef, onToggleKeydown };
};
