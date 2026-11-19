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
  Flex,
  FormGroup,
  FormHelperText,
  MenuToggle,
  MenuToggleElement,
  Select,
  SelectList,
  SelectOption,
} from "@patternfly/react-core";
import Text from "~/components/core/Text";
import FooterEntryOption, {
  FOOTER_ENTRY_VALUE,
} from "~/components/form/primitives/FooterEntryOption";
import { useComboboxKeyboard } from "~/hooks/use-combobox-keyboard";
import { resolveAriaLabelProps, useFieldLabel } from "~/hooks/use-field-label";
import { useFieldContext } from "~/hooks/form-contexts";

import type { FieldLabelOptions } from "~/hooks/use-field-label";
import type { FooterEntry } from "~/components/form/primitives/FooterEntryOption";

export type DropdownOption<T> =
  | { value: T; label: React.ReactNode; description?: React.ReactNode; isDisabled?: boolean }
  | { divider: true };

type DropdownFieldProps<T> = FieldLabelOptions & {
  /** The field label. */
  label: React.ReactNode;
  /**
   * Whether the label is only read by screen readers, for a field whose label
   * is already shown above it, e.g. as the title of a section it is the only
   * field of.
   */
  isLabelVisuallyHidden?: boolean;
  /** The available options. */
  options: DropdownOption<T>[];
  /** An entry rendered last, offering something other than a value. */
  footerEntry?: FooterEntry;
  /** Optional helper text shown below the select, e.g. a PatternFly `HelperText`. */
  helperText?: React.ReactNode;
  /**
   * Text shown in the closed field while no option is selected, prompting the
   * user to pick one (e.g. "Select a product").
   */
  placeholder?: React.ReactNode;
  /**
   * Tallest the open list grows before its options scroll (e.g. "15rem"), so a
   * long list does not run off the screen. The footer entry, if any, stays
   * pinned at the foot of the list, always in reach.
   */
  maxMenuHeight?: string;
  isDisabled?: boolean;
  /**
   * Render prop for content that depends on the current value, such as
   * nested fields that appear when a specific option is selected.
   */
  children?: (value: T) => React.ReactNode;
  /** Buttons shown next to the dropdown, acting on the picked value. */
  actions?: React.ReactNode;
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
 * Supports a `maxMenuHeight` for long lists: the options scroll past it while
 * the footer entry stays visible at the foot of the list.
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
 *
 * @example <caption>A long list that scrolls, keeping the footer entry visible</caption>
 * <field.DropdownField
 *   label={_("Product")}
 *   options={productOptions}
 *   maxMenuHeight="20rem"
 *   footerEntry={{ label: _("Browse with details..."), onSelect: openDialog, opensDialog: true }}
 * />
 */
export default function DropdownField<T extends string>({
  label,
  isLabelVisuallyHidden = false,
  options,
  footerEntry,
  helperText,
  placeholder,
  maxMenuHeight,
  isDisabled = false,
  children,
  actions,
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

  // Without a visible label element, the toggle points to the hidden one.
  const toggleLabelProps = isLabelVisuallyHidden
    ? resolveAriaLabelProps(labelProps, { "aria-labelledby": labelId })
    : labelProps;

  const selectedOption = options.find(
    (opt) => !("divider" in opt) && opt.value === field.state.value,
  );

  const select = (
    <Select
      ref={menuRef}
      isOpen={isOpen}
      isScrollable={maxMenuHeight !== undefined}
      maxMenuHeight={maxMenuHeight}
      className={maxMenuHeight && "agm-field-option-menu"}
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
          isPlaceholder={!selectedOption && !field.state.value}
          aria-haspopup="listbox"
          isDisabled={isDisabled}
          {...toggleLabelProps}
        >
          {selectedOption && "label" in selectedOption
            ? selectedOption.label
            : field.state.value || placeholder}
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
        {footerEntry &&
          (maxMenuHeight ? (
            // Pinned to the foot of the scrolling list, so it draws its own
            // separator rather than leaving one behind as the options scroll.
            <FooterEntryOption
              entry={footerEntry}
              hasDivider={false}
              className="agm-field-footer-entry"
            />
          ) : (
            <FooterEntryOption entry={footerEntry} hasDivider={options.length > 0} />
          ))}
      </SelectList>
    </Select>
  );

  return (
    <FormGroup
      fieldId={field.name}
      label={isLabelVisuallyHidden ? undefined : <span id={labelId}>{label}</span>}
    >
      {isLabelVisuallyHidden && (
        <Text id={labelId} srOnly>
          {label}
        </Text>
      )}
      {/* Always wrapped, so buttons showing up next to it do not recreate the
          dropdown, which would lose the focus it holds or gets back. */}
      <Flex alignItems={{ default: "alignItemsCenter" }} gap={{ default: "gapSm" }}>
        {select}
        {actions}
      </Flex>
      {helperText && <FormHelperText>{helperText}</FormHelperText>}
      {children?.(field.state.value)}
    </FormGroup>
  );
}
