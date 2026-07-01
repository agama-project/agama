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

import type { TranslatedString } from "~/i18n";

/**
 * Ways a consumer can adjust the accessible name of a form field.
 *
 * The three options are independent escape hatches, listed from most to least
 * control:
 *
 * - `aria-label`: a literal accessible name. Replaces the visible label
 *   entirely. Use when no on-screen text describes the control.
 * - `aria-labelledby`: a list of element IDs to build the accessible name
 *   from. Replaces the visible label entirely. Use when other on-screen
 *   elements describe the control.
 * - `labelPrefixedBy`: one or more element IDs whose text is placed *before*
 *   the field's own visible label, producing a contextual name like
 *   "Hostname Mode". Unlike `aria-labelledby`, the field's own label is kept,
 *   so the visible text stays part of the accessible name (WCAG 2.5.3).
 *
 * `labelPrefixedBy` exists mainly to disambiguate fields that share a generic
 * label ("Mode", "Password") by reusing text already on screen, such as a
 * fieldset legend or a heading, without introducing a new translatable
 * string. It is agnostic about which kind of element the id(s) belong to;
 * any element with an id and readable text works.
 */
export type FieldLabelOptions = {
  "aria-label"?: TranslatedString;
  "aria-labelledby"?: string;
  /**
   * One or more element IDs (space-separated) whose text prefixes the field's
   * own label in the accessible name. They are all placed before the label,
   * matching the ID order.
   */
  labelPrefixedBy?: string;
};

/**
 * Resolves the accessible name of a form field from a field name and the
 * consumer-provided {@link FieldLabelOptions}.
 *
 * Returns a stable `labelId` for the element wrapping the visible label and a
 * `labelProps` object to spread onto the control (input, toggle, group). When a
 * consumer passes `aria-label` or `aria-labelledby` those win; otherwise
 * `labelPrefixedBy` is composed with the field's own label.
 *
 * @param fieldName - The field name, typically `field.name` from `useFieldContext`.
 * @param options - Consumer-provided labelling options.
 *
 * @example
 * // Default: no options. The control is labelled by its visible label, which
 * // FormGroup associates through `fieldId`. `labelProps` carries no aria
 * // attributes, so spreading it is a no-op.
 * const { labelId, labelProps } = useFieldLabel(field.name);
 * return (
 *   <FormGroup fieldId={field.name} label={<span id={labelId}>{label}</span>}>
 *     <TextInput id={field.name} {...labelProps} />
 *   </FormGroup>
 * );
 *
 * @example
 * // Prefix the label with a fieldset legend. Renders a visible "Mode" label
 * // but exposes "Hostname Mode" to assistive tech, so two "Mode" fields on the
 * // same page stay distinguishable without new translations.
 * <Fieldset legend={_("Hostname")} legendId="hostname-legend">
 *   <form.AppField name="hostnameMode">
 *     {(field) => (
 *       <field.DropdownField label={_("Mode")} labelPrefixedBy="hostname-legend" />
 *     )}
 *   </form.AppField>
 * </Fieldset>
 * // aria-labelledby="hostname-legend hostnameMode-label" -> "Hostname Mode"
 *
 * @example
 * // Several prefixes, applied in order, for a field nested two levels deep.
 * <field.MaskedField label={_("Password")} labelPrefixedBy="auth-section root-legend" />
 * // aria-labelledby="auth-section root-legend password-label"
 * //   -> "Authentication Root user Password"
 *
 * @example
 * // Full control with a literal name, e.g. an icon-only or otherwise
 * // unlabelled control.
 * <field.TextField label={_("Search")} aria-label={_("Filter the package list")} />
 *
 * @example
 * // Full control by referencing other on-screen elements. Replaces the visible
 * // label entirely, so use only when those elements fully describe the field.
 * <field.NumberField label={_("Size")} aria-labelledby="partition-name size-unit" />
 */
export function useFieldLabel(fieldName: string, options: FieldLabelOptions = {}) {
  const { "aria-label": ariaLabel, "aria-labelledby": ariaLabelledBy, labelPrefixedBy } = options;
  const labelId = `${fieldName}-label`;
  const prefixedLabelledBy = labelPrefixedBy ? `${labelPrefixedBy} ${labelId}` : undefined;

  // When no option applies both attributes stay undefined. React omits
  // undefined attributes on spread, so `labelProps` is a no-op in that case and
  // the control keeps the label association FormGroup sets up via `fieldId`.
  return {
    labelId,
    labelProps: {
      "aria-label": ariaLabel,
      "aria-labelledby": ariaLabelledBy ?? prefixedLabelledBy,
    },
  };
}

type AriaNameProps = Pick<FieldLabelOptions, "aria-label" | "aria-labelledby">;

/**
 * Picks a single aria-label/aria-labelledby pair to spread onto an element
 * that needs its own accessible name, from the `labelProps` a {@link useFieldLabel}
 * call produced.
 *
 * `aria-labelledby` wins when both are present, matching the accessible name
 * computation order browsers already apply
 * (https://www.w3.org/TR/accname-1.2/). `fallback` is used only when
 * `labelProps` carries neither, e.g. to self-reference the field's own label
 * when the element has no native label association to fall back on.
 */
export function resolveAriaLabelProps(
  labelProps: AriaNameProps,
  fallback?: AriaNameProps,
): AriaNameProps {
  if (labelProps["aria-labelledby"]) return { "aria-labelledby": labelProps["aria-labelledby"] };
  if (labelProps["aria-label"]) return { "aria-label": labelProps["aria-label"] };
  return fallback ?? {};
}
