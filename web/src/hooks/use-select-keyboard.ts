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
 * Return value of the {@link useSelectKeyboard} hook.
 */
type UseSelectKeyboardReturn = {
  /** Whether the menu is currently open. */
  isOpen: boolean;
  /** Function to programmatically open or close the menu. */
  setIsOpen: (isOpen: boolean) => void;
  /** Ref to attach to the PatternFly Select component (forwards to underlying Menu). */
  menuRef: React.RefObject<HTMLDivElement>;
  /** Keyboard event handler to attach to the Select's onToggleKeydown prop. */
  onToggleKeydown: (event: KeyboardEvent) => void;
};

/**
 * Hook for W3C-compliant keyboard navigation in PatternFly Select components.
 *
 * Implements the W3C ARIA Authoring Practices Guide (APG) Select-Only Combobox
 * pattern, which allows arrow keys to open the menu when closed while
 * maintaining the explore-then-commit interaction that protects all users from
 * accidental value changes.
 *
 * ## Why this pattern exists
 *
 * PatternFly's Select uses option descriptions (not available in native
 * `<select>`), which requires a custom component. The W3C combobox pattern's
 * explore-then-commit interaction provides benefits for all users in reactive
 * forms:
 *
 * **For sighted users:** Lets users explore options without triggering form
 * changes they haven't committed to yet. In forms where selections control
 * field visibility (e.g., IP settings modes), users can read all option
 * descriptions and understand their choices before causing the form to
 * reconfigure.
 *
 * **For screen reader users:** Prevents accidental value changes while
 * exploring options. Users can hear all descriptions before committing, rather
 * than changing the value with each arrow press.
 *
 * **Arrow keys open the menu but don't commit** - users must press Enter/Space
 * to confirm their choice or Escape to cancel. This is faster than requiring
 * Enter/Space to open (fewer steps) while remaining safer than native
 * `<select>` behavior (immediate changes on arrow press).
 *
 * @remarks
 * The hook manages the menu open state and provides a keyboard handler that:
 * - Opens the menu and focuses the first item when ↓ is pressed on a closed toggle
 * - Opens the menu and focuses the last item when ↑ is pressed on a closed toggle
 * - Delegates to PatternFly's default arrow navigation when the menu is already open
 * - Does NOT commit value changes until the user explicitly confirms with Enter/Space
 *
 * @example
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
 * @see https://www.w3.org/WAI/ARIA/apg/patterns/combobox/examples/combobox-select-only/
 */
export const useSelectKeyboard = (): UseSelectKeyboardReturn => {
  const menuRef = useRef<HTMLDivElement>(null);
  const openedWithArrowUp = useRef(false);
  const prevIsOpen = useRef(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // When menu opens, focus first or last item based on which arrow key triggered it.
    // Pattern borrowed from PatternFly's shouldFocusFirstItemOnOpen implementation:
    // https://github.com/patternfly/patternfly-react/blob/main/packages/react-core/src/components/Select/Select.tsx
    if (prevIsOpen.current === false && isOpen === true) {
      setTimeout(() => {
        // Selector matches PatternFly's internal implementation
        const selector = "li button:not(:disabled), li input:not(:disabled)";
        const items = menuRef.current?.querySelectorAll<HTMLElement>(selector);
        if (items?.length) {
          const target = openedWithArrowUp.current ? items[items.length - 1] : items[0];
          target.focus({ preventScroll: true });
        }
        openedWithArrowUp.current = false;
      }, 0);
    }
    prevIsOpen.current = isOpen;
  }, [isOpen]);

  const onToggleKeydown = (event: KeyboardEvent) => {
    // Only handle arrow keys when menu is closed (to open it and focus first/last item).
    // When menu is open, PatternFly's Select handles arrow navigation naturally.
    if (!isOpen && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      event.preventDefault();
      openedWithArrowUp.current = event.key === "ArrowUp";
      setIsOpen(true);
    }
  };

  return { isOpen, setIsOpen, menuRef, onToggleKeydown };
};
