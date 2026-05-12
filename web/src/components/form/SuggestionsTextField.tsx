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

import React, { useEffect, useRef } from "react";
import { TextInput, TextInputProps } from "@patternfly/react-core";

export type SuggestionsTextFieldProps = Omit<TextInputProps, "list"> & {
  /** Array of suggestion strings to display */
  suggestions?: string[];
};

/**
 * A text input with native datalist suggestions.
 *
 * This component provides a free-text input where users can type any value they
 * want. Suggestions are offered via a native HTML datalist element, which
 * provides browser-native autocomplete behavior without forcing the user to
 * select from the list.
 *
 * Key behaviors:
 *   - Free text is always preserved (Tab, blur, Escape never clear the input)
 *   - Suggestions appear as the user types but are optional
 *   - No extra keyboard navigation or ARIA wiring needed (browser handles it)
 *   - Works consistently across screen readers and browsers
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/datalist
 *
 * @note This component will be migrated to integrate with TanStack Form in the future.
 *
 * ## Current Implementation: Debounce + Focus Tracking
 *
 * This component uses TWO mechanisms to prevent flickering and focus loss:
 *
 * ### 1. Debounced onChange (400ms)
 *
 * **Why it's needed:**
 * Current parent forms (PartitionPage, LogicalVolumePage,
 * FormattableDevicePage) use useState and trigger multiple state updates on
 * every onChange:
 *
 * ```tsx
 * const changeMountPoint = (value: string) => {
 *   setAutoRefreshFilesystem(true);  // State update 1
 *   setAutoRefreshSize(true);        // State update 2
 *   setMountPoint(value);            // State update 3
 *   // This triggers re-renders, validation, and callbacks cascade
 * };
 * ```
 *
 * Additionally, these parents:
 *  - Run validation on every change (not aligned with current guidelines: we
 *    only know the user finished filling the form when they hit submit)
 *  - Disable the Accept button based on validation state (we don't want
 *    disabled submit buttons)
 *  - Re-render excessively due to passing callbacks down and validating on
 *    every change
 *
 * Calling onChange on every keystroke causes:
 *  - Multiple parent re-renders per character typed
 *  - Validation running on incomplete input
 *  - Flickering and input lag
 *  - Focus loss mid-typing
 *
 * Debouncing (400ms) reduces parent updates while user is typing.
 *
 * ### 2. Focus Tracking
 *
 * Debouncing alone creates a race condition:
 *
 * ```
 *  1. User types "/h"        → internalValue = "/h" (onChange debounced)
 *  2. User types "ome"       → internalValue = "/home"
 *  3. 400ms after step 1     → onChange("/h") fires → parent updates
 *  4. Parent re-renders      → externalValue = "/h"
 *  5. Effect runs            → setInternalValue("/h")
 *  6. User's "ome" is lost!  → Input shows "/h" instead of "/home"
 * ```
 *
 * Focus tracking prevents this: while focused (user is typing), we ignore
 * external value updates. On blur, we sync to pick up any parent
 * transformations.
 *
 * ### Behavior Summary
 *
 * - **While typing (focused)**: Internal state only, onChange debounced (400ms)
 * - **On blur**: Cancel debounce, fire onChange immediately, sync with parent value
 * - **External updates when unfocused**: Sync immediately (form reset, initial load)
 * - **External updates when focused**: Ignored (prevents race conditions)
 *
 * ## After TanStack Form Migration
 *
 * All this complexity disappears because:
 * - TanStack Form manages field state internally (no parent re-renders)
 * - Validation deferred to submit via `validators.onSubmit`
 * - No multiple setState calls in parent
 * - Component can be simplified to call `field.handleChange()` directly
 *
 * Current storage forms (PartitionPage, etc.) will be migrated to follow
 * validation-on-submit guidelines, removing the need for this workaround.
 *
 * @example
 * ```tsx
 * const [mountPoint, setMountPoint] = useState("");
 * const suggestions = ["/boot", "/home", "/var"];
 *
 * <FormGroup fieldId="mount-point" label={_("Mount point")}>
 *   <SuggestionsTextField
 *     id="mount-point"
 *     value={mountPoint}
 *     suggestions={suggestions}
 *     onChange={(_event, value) => setMountPoint(value)}
 *   />
 *   <FormHelperText>
 *     <HelperText>
 *       <HelperTextItem>{_("Enter a mount point")}</HelperTextItem>
 *     </HelperText>
 *   </FormHelperText>
 * </FormGroup>
 * ```
 */
function SuggestionsTextField({
  id,
  suggestions = [],
  value: externalValue,
  onChange,
  onBlur,
  ...textInputProps
}: SuggestionsTextFieldProps): React.ReactElement {
  const datalistId = `${id}-datalist`;

  // Track if input is focused to prevent external updates while typing
  const isFocused = useRef<boolean>(false);

  // Ref to store the debounce timeout
  const debounceTimeout = useRef<number | null>(null);

  // Maintain internal state for the input
  const [internalValue, setInternalValue] = React.useState<string>(String(externalValue || ""));

  // Sync from external value only when not focused
  useEffect(() => {
    if (!isFocused.current) {
      setInternalValue(String(externalValue || ""));
    }
  }, [externalValue]);

  // Clean up debounce timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeout.current !== null) {
        window.clearTimeout(debounceTimeout.current);
      }
    };
  }, []);

  // Memoize options to avoid recreating them on every render
  const options = React.useMemo(
    () =>
      suggestions.map((suggestion, index) => (
        <option key={`${suggestion}-${index}`} value={suggestion} />
      )),
    [suggestions],
  );

  const handleFocus = (event: React.FocusEvent<HTMLInputElement>) => {
    isFocused.current = true;
    if (textInputProps.onFocus) {
      textInputProps.onFocus(event);
    }
  };

  const handleChange = (event: React.FormEvent<HTMLInputElement>, newValue: string) => {
    // Update internal state immediately for responsive typing
    setInternalValue(newValue);

    // Clear any pending debounced onChange
    if (debounceTimeout.current !== null) {
      window.clearTimeout(debounceTimeout.current);
    }

    // Debounce onChange to prevent excessive parent re-renders
    if (onChange) {
      debounceTimeout.current = window.setTimeout(() => {
        onChange(event, newValue);
      }, 400);
    }
  };

  const handleBlur = (event: React.FocusEvent<HTMLInputElement>) => {
    isFocused.current = false;

    // Cancel debounced onChange and sync immediately on blur
    if (debounceTimeout.current !== null) {
      window.clearTimeout(debounceTimeout.current);
      debounceTimeout.current = null;
    }

    if (onChange) {
      onChange(event, internalValue);
    }

    // Sync with external value on blur in case parent transformed it
    setInternalValue(String(externalValue || ""));

    if (onBlur) {
      onBlur(event);
    }
  };

  return (
    <>
      <TextInput
        id={id}
        type="text"
        list={datalistId}
        value={internalValue}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        {...textInputProps}
      />
      <datalist id={datalistId}>{options}</datalist>
    </>
  );
}

export default SuggestionsTextField;
