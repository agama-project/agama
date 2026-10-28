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
  FormHelperText,
  HelperText,
  HelperTextItem,
  TextInput,
} from "@patternfly/react-core";
import Text from "~/components/core/Text";
import { useFieldLabel } from "~/hooks/use-field-label";
import { useFieldContext } from "~/hooks/form-contexts";

import type { FieldLabelOptions } from "~/hooks/use-field-label";

type NumberFieldProps = FieldLabelOptions & {
  label: React.ReactNode;
  helperText?: React.ReactNode;
  min?: number;
  max?: number;
};

/**
 * A numeric input tied to a TanStack Form field via `useFieldContext`.
 * Must be used inside a `form.AppField` render prop.
 *
 * @see useFieldContext for field component conventions.
 * @see useFieldLabel for adjusting the accessible name (`labelPrefixedBy`, etc.).
 */
export default function NumberField({
  label,
  helperText,
  min,
  max,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  labelPrefixedBy,
}: NumberFieldProps) {
  const field = useFieldContext<number | "">();
  const { labelId, labelProps } = useFieldLabel(field.name, {
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledBy,
    labelPrefixedBy,
  });
  const error = field.state.meta.errors[0];

  return (
    <FormGroup fieldId={field.name} label={<span id={labelId}>{label}</span>}>
      <TextInput
        id={field.name}
        name={field.name}
        value={field.state.value}
        type="number"
        min={min}
        max={max}
        validated={error ? "error" : "default"}
        onChange={(_, value) => field.handleChange(value === "" ? undefined : Number(value))}
        {...labelProps}
      />
      {(error || helperText) && (
        <FormHelperText>
          <HelperText>
            {helperText && (
              <HelperTextItem>
                <Text textStyle={["fontSizeSm", "textColorSubtle"]}>{helperText}</Text>
              </HelperTextItem>
            )}
            {error && <HelperTextItem variant="error">{error}</HelperTextItem>}
          </HelperText>
        </FormHelperText>
      )}
    </FormGroup>
  );
}
