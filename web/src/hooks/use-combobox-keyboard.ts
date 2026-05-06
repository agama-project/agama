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
import type { MenuToggleElement } from "@patternfly/react-core";

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
 * Options for the {@link useComboboxKeyboard} hook.
 */
type UseComboboxKeyboardOptions = {
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
 * Return value of the {@link useComboboxKeyboard} hook.
 */
type UseComboboxKeyboardReturn = {
  /** Whether the menu is currently open. */
  isOpen: boolean;
  /** Function to programmatically open or close the menu. */
  setIsOpen: (isOpen: boolean) => void;
  /** Ref to attach to the PatternFly component (forwards to underlying Menu). */
  menuRef: React.RefObject<HTMLDivElement>;
  /**
   * Merges PatternFly's toggle ref with the hook's internal focus restoration ref.
   *
   * Creates a ref callback that forwards to both PatternFly's ref (for dropdown
   * functionality) and the hook's internal ref (for focus restoration).
   *
   * @param pfToggleRef - The ref provided by PatternFly's toggle render prop
   * @returns A ref callback that forwards to both refs
   *
   * @example
   * ```tsx
   * toggle={(pfRef) => (
   *   <MenuToggle ref={getToggleRef(pfRef)}>
   *     {value}
   *   </MenuToggle>
   * )}
   * ```
   */
  getToggleRef: (
    pfToggleRef?: React.Ref<MenuToggleElement>,
  ) => React.RefCallback<MenuToggleElement>;
  /** Keyboard event handler to attach to the component's onToggleKeydown or onKeyDown prop. */
  onToggleKeydown: (event: React.KeyboardEvent | KeyboardEvent) => void;
};

/**
 * Hook providing W3C-aligned keyboard navigation for PatternFly Select and
 * Menu-based dropdown components.
 *
 * Currently implements arrow-key-to-open behavior based on the W3C ARIA
 * Authoring Practices Guide (APG) Select-Only Combobox pattern:
 *
 *   - ArrowDown opens a closed popup and focuses the first item
 *   - ArrowUp opens a closed popup and focuses the last item
 *
 * The interaction follows an explore-then-commit model, allowing users to
 * navigate options without immediately changing the current value or triggering
 * actions.
 *
 * This improves usability for:
 *
 *   - Sighted users exploring reactive forms without causing unintended updates
 *   - Screen reader users reviewing options before committing a selection
 *   - Keyboard users by avoiding the extra Enter/Space step to open menus
 *
 * @remarks
 * This hook is intended to become the shared keyboard accessibility layer for
 * PatternFly dropdown components that behave like comboboxes or listboxes.
 *
 * The current implementation focuses on the closed combobox interaction model
 * from the APG Select-Only Combobox pattern. Additional APG-recommended
 * behaviors for both combobox and listbox popup patterns may be added over time
 * as PatternFly component APIs and internal infrastructure permit.
 *
 * Additional APG behaviors for both closed combobox and listbox popup patterns
 * may be implemented over time as PatternFly infrastructure and component APIs
 * allow.
 *
 * The hook can either manage its own open state or integrate with externally
 * managed state.
 *
 * @example Basic usage (internal state)
 * ```tsx
 * const { isOpen, setIsOpen, menuRef, getToggleRef, onToggleKeydown } = useComboboxKeyboard();
 *
 * <Select
 *   ref={menuRef}
 *   isOpen={isOpen}
 *   onOpenChange={setIsOpen}
 *   onToggleKeydown={onToggleKeydown}
 *   toggle={(pfRef) => (
 *     <MenuToggle ref={getToggleRef(pfRef)} onClick={() => setIsOpen(!isOpen)}>
 *       {value}
 *     </MenuToggle>
 *   )}
 * >
 *   <SelectList>...</SelectList>
 * </Select>
 * ```
 *
 * @example With external state
 * ```tsx
 * const [isOpen, setIsOpen] = useState(false);
 *
 * const { menuRef, getToggleRef, onToggleKeydown } = useComboboxKeyboard({
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
export const useComboboxKeyboard = (
  options: UseComboboxKeyboardOptions = {},
): UseComboboxKeyboardReturn => {
  const { component = "select", isOpen: externalIsOpen, setIsOpen: externalSetIsOpen } = options;

  const menuRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<MenuToggleElement | null>(null);
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

    // When menu closes, restore focus to the toggle button
    if (prevIsOpen.current === true && isOpen === false) {
      setTimeout(() => {
        toggleRef.current?.focus();
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

  /**
   * Creates a ref callback that forwards to both PatternFly's ref and the hook's internal ref.
   *
   * PatternFly needs the ref for dropdown positioning and click-outside detection.
   * The hook needs the ref to restore focus to the toggle when the menu closes.
   */
  const getToggleRef = (pfToggleRef?: React.Ref<MenuToggleElement>) => {
    return (element: MenuToggleElement | null) => {
      // Forward to PatternFly's ref (could be callback or object ref)
      if (pfToggleRef) {
        if (typeof pfToggleRef === "function") {
          pfToggleRef(element);
        } else {
          (pfToggleRef as React.MutableRefObject<MenuToggleElement | null>).current = element;
        }
      }

      // Save to internal ref for focus restoration
      toggleRef.current = element;
    };
  };

  return { isOpen, setIsOpen, menuRef, getToggleRef, onToggleKeydown };
};
