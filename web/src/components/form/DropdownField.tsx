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

import React from "react";
import {
  FormGroup,
  MenuToggle,
  MenuToggleElement,
  Select,
  SelectList,
  SelectOption,
} from "@patternfly/react-core";
import { useComboboxKeyboard } from "~/hooks/use-combobox-keyboard";
import { useFieldContext } from "~/hooks/form-contexts";

export type DropdownOption<T> = {
  value: T;
  label: React.ReactNode;
  description?: React.ReactNode;
  isDisabled?: boolean;
};

type DropdownFieldProps<T> = {
  /** The field label. */
  label: React.ReactNode;
  /** The available options. */
  options: DropdownOption<T>[];
  /** Optional helper text shown below the select. */
  helperText?: React.ReactNode;
  isDisabled?: boolean;
  /**
   * Render prop for content that depends on the current value, such as
   * nested fields that appear when a specific option is selected.
   */
  children?: (value: T) => React.ReactNode;
};

/**
 * A form field that renders a select tied to a TanStack Form field via
 * `useFieldContext`. Must be used inside a `form.AppField` render prop.
 *
 * Supports a render prop `children` for dependent content that should appear
 * or change based on the selected value.
 *
 * ## Implementation note: PatternFly menu, not a native select
 *
 * Despite looking similar to a native `<select>`, this component uses
 * PatternFly's `Select` (a menu-based combobox following the W3C APG
 * Select-Only Combobox pattern). The two follow different ARIA patterns and
 * behave differently with the keyboard:
 *
 * - Native `<select>`: arrow keys change the value immediately.
 * - PatternFly `Select`: requires a two-step interaction — open the menu
 *   first (Enter, Space, or click), then navigate with arrow keys, then
 *   confirm with Enter. Values are not committed until confirmed.
 *
 * The two-step flow is intentional: on a native select, a screen reader user
 * landing on the wrong option has already changed the form value before they
 * could hear what it said. The W3C pattern separates navigation from
 * selection to protect them.
 *
 * The W3C pattern does allow a middle ground — pressing ↓/↑ on a closed
 * toggle should open the menu and focus the first or last item without
 * committing a value. This component implements that via {@link useComboboxKeyboard}.
 *
 * @see useFieldContext for field component conventions.
 *
 * @example
 * <form.AppField name="ipv4Mode">
 *   {(field) => (
 *     <field.DropdownField label={_("IPv4 Settings")} options={IPV4_MODE_OPTIONS}>
 *       {(value) => value !== "unset" && <IpAddressFields />}
 *     </field.DropdownField>
 *   )}
 * </form.AppField>
 */
export default function DropdownField<T extends string>({
  label,
  options,
  helperText,
  isDisabled = false,
  children,
}: DropdownFieldProps<T>) {
  const field = useFieldContext<T>();
  const { isOpen, setIsOpen, menuRef, getToggleRef, onToggleKeydown } = useComboboxKeyboard();

  const selectedOption = options.find(({ value }) => value === field.state.value);

  return (
    <FormGroup fieldId={field.name} label={label}>
      <Select
        ref={menuRef}
        isOpen={isOpen}
        selected={field.state.value}
        onSelect={(_, value) => {
          if (typeof value === "string") field.handleChange(value as T);
          setIsOpen(false);
        }}
        onOpenChange={setIsOpen}
        onToggleKeydown={onToggleKeydown}
        shouldFocusToggleOnSelect
        toggle={(pfToggleRef: React.Ref<MenuToggleElement>) => (
          <MenuToggle
            id={field.name}
            ref={getToggleRef(pfToggleRef)}
            onClick={() => setIsOpen(!isOpen)}
            isExpanded={isOpen}
            isDisabled={isDisabled}
          >
            {selectedOption?.label ?? field.state.value}
          </MenuToggle>
        )}
      >
        <SelectList>
          {options.map((opt) => (
            <SelectOption
              key={opt.value}
              value={opt.value}
              description={opt.description}
              isDisabled={opt.isDisabled}
            >
              {opt.label}
            </SelectOption>
          ))}
        </SelectList>
      </Select>
      {helperText}
      {children?.(field.state.value)}
    </FormGroup>
  );
}
