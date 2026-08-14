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
  Divider,
  FormGroup,
  MenuToggle,
  MenuToggleElement,
  Select,
  SelectList,
  SelectOption,
} from "@patternfly/react-core";
import Text from "~/components/core/Text";
import { useComboboxKeyboard } from "~/hooks/use-combobox-keyboard";
import { useFieldLabel } from "~/hooks/use-field-label";
import { useFieldContext } from "~/hooks/form-contexts";
import { _ } from "~/i18n";

import type { FieldLabelOptions } from "~/hooks/use-field-label";
import type { TranslatedString } from "~/i18n";

export type DropdownOption<T> =
  | { value: T; label: React.ReactNode; description?: React.ReactNode; isDisabled?: boolean }
  | { divider: true };

/**
 * The last entry of the list, offering something other than a value.
 *
 * Activating it closes the menu, returns focus to the toggle and leaves the
 * field untouched. What it does from there is up to `onSelect`: open a dialog,
 * go to another page, start creating something the list cannot offer yet.
 *
 * ## Why it lives in the list, not beside the field
 *
 * A second control beside the field would do one job with two elements, and
 * put a tab stop in everyone's path for help that is not always needed. An
 * entry inside the list costs nothing to whoever does not open it, and sits
 * where the user already is when the values on offer turn out not to be
 * enough. Give the route a control of its own only when most users are
 * expected to take it.
 *
 * ## Why not PatternFly's MenuFooter
 *
 * That footer renders outside the list, so whatever it holds is not an option:
 * it falls out of the arrow key sequence and of what a screen reader
 * announces. This entry is a real option, reached like any other.
 *
 * ## Saying that it leads somewhere
 *
 * ARIA does not allow `aria-haspopup` on an option, and there is nowhere else
 * to put it: the list admits only options, and a control outside the list is
 * unreachable with PatternFly's key handling.
 *
 * The label does that work. Keep it to two or three words ending in an
 * ellipsis, the usual sign that more follows rather than a value being set.
 *
 * An ellipsis is silent when read aloud. Set `opensDialog` and screen reader
 * users hear "Opens a dialog" after the label. Set `hint` to have them hear
 * something else.
 */
export type FooterEntry = {
  /** Text shown in the entry. */
  label: React.ReactNode;
  /** Called when the user activates the entry. */
  onSelect: () => void;
  /**
   * Whether activating the entry opens a dialog, the most common case. It adds
   * a standard hint after the label for screen reader users, which ARIA cannot
   * express on an option through `aria-haspopup`.
   */
  opensDialog?: boolean;
  /**
   * Replaces that hint for an entry doing something else. Wins over
   * {@link opensDialog}, and works on its own.
   */
  hint?: TranslatedString;
};

/**
 * Value carried by the footer entry.
 *
 * The select reports every activation through a single callback that hands
 * back only the value of what was activated, so the footer entry needs a value
 * of its own to be told apart from the real options. It is never committed to
 * the field, and no realistic field value looks like it.
 */
const FOOTER_ENTRY_VALUE = "dropdown-field/footer-entry";

type DropdownFieldProps<T> = FieldLabelOptions & {
  /** The field label. */
  label: React.ReactNode;
  /** The available options. */
  options: DropdownOption<T>[];
  /** An entry rendered last, offering something other than a value. */
  footerEntry?: FooterEntry;
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
 * Supports a `footerEntry` for offering something beyond the listed values. It
 * is rendered after a divider, at the end of the list.
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
 *
 * @example <caption>With a footer entry that opens a dialog</caption>
 * <field.DropdownField
 *   label={_("Device name")}
 *   options={deviceOptions}
 *   footerEntry={{
 *     label: _("Browse with details..."),
 *     onSelect: openDeviceDialog,
 *   }}
 * />
 */
export default function DropdownField<T extends string>({
  label,
  options,
  footerEntry,
  helperText,
  isDisabled = false,
  children,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  labelPrefixedBy,
}: DropdownFieldProps<T>) {
  const field = useFieldContext<T>();
  const { labelId, labelProps } = useFieldLabel(field.name, {
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledBy,
    labelPrefixedBy,
  });
  const { isOpen, setIsOpen, menuRef, getToggleRef, onToggleKeydown } = useComboboxKeyboard();

  const selectedOption = options.find(
    (opt) => !("divider" in opt) && opt.value === field.state.value,
  );

  // TRANSLATORS: told to screen reader users about an entry that opens a
  // dialog, since the ellipsis ending its text says nothing when read aloud.
  const footerEntryHint = footerEntry?.hint ?? (footerEntry?.opensDialog && _("Opens a dialog"));

  return (
    <FormGroup fieldId={field.name} label={<span id={labelId}>{label}</span>}>
      <Select
        ref={menuRef}
        isOpen={isOpen}
        selected={field.state.value}
        onSelect={(_, value) => {
          setIsOpen(false);
          if (value === FOOTER_ENTRY_VALUE) {
            footerEntry.onSelect();
            return;
          }
          if (typeof value === "string") field.handleChange(value as T);
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
            {...labelProps}
          >
            {selectedOption && "label" in selectedOption ? selectedOption.label : field.state.value}
          </MenuToggle>
        )}
      >
        <SelectList>
          {options.map((opt, i) =>
            "divider" in opt ? (
              <Divider key={`divider-${i}`} component="li" />
            ) : (
              <SelectOption
                key={String(opt.value)}
                value={opt.value}
                description={opt.description}
                isDisabled={opt.isDisabled}
              >
                {opt.label}
              </SelectOption>
            ),
          )}
          {footerEntry && (
            <>
              {options.length > 0 && <Divider component="li" />}
              <SelectOption value={FOOTER_ENTRY_VALUE}>
                {footerEntry.label}
                {footerEntryHint && <Text srOnly>{footerEntryHint}</Text>}
              </SelectOption>
            </>
          )}
        </SelectList>
      </Select>
      {helperText}
      {children?.(field.state.value)}
    </FormGroup>
  );
}
