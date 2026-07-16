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
import { Checkbox } from "@patternfly/react-core";
import { useFieldContext } from "~/hooks/form-contexts";

import type { TranslatedString } from "~/i18n";

type CheckboxFieldProps = {
  label: TranslatedString;
  description?: React.ReactNode;
  /**
   * Literal accessible name for the checkbox. Replaces the visible label as the
   * accessible name; use only when the visible label is not descriptive enough.
   */
  "aria-label"?: TranslatedString;
  /**
   * IDs of elements that name the checkbox. Replaces the visible label as the
   * accessible name; use when other on-screen elements describe it.
   */
  "aria-labelledby"?: string;
};

/**
 * A checkbox tied to a TanStack Form field via `useFieldContext`.
 * Must be used inside a `form.AppField` render prop.
 *
 * Its visible `label` is also its accessible name. Pass `aria-label` or
 * `aria-labelledby` only to override that for assistive technologies.
 *
 * @see useFieldContext for field component conventions.
 */
export default function CheckboxField({
  label,
  description,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
}: CheckboxFieldProps) {
  const field = useFieldContext<boolean>();

  return (
    <Checkbox
      id={field.name}
      label={label}
      description={description}
      isChecked={field.state.value}
      onChange={(_, checked) => field.handleChange(checked)}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
    />
  );
}
