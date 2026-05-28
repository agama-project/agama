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
  Radio,
  Stack,
} from "@patternfly/react-core";
import Text from "~/components/core/Text";
import { useFieldContext } from "~/hooks/form-contexts";
import type { TranslatedString } from "~/i18n";

export type RadioOption<T> = {
  value: T;
  label: TranslatedString;
  description?: React.ReactNode;
  isDisabled?: boolean;
};

type RadioGroupFieldProps<T> = {
  /** The field label. */
  label: React.ReactNode;
  /** The available options. */
  options: RadioOption<T>[];
  /** Optional helper text shown below the radio group. */
  helperText?: React.ReactNode;
  /**
   * Render prop for content that depends on the current value, such as
   * nested fields that appear when a specific option is selected.
   */
  children?: (value: T) => React.ReactNode;
};

/**
 * A radio group field tied to a TanStack Form field via `useFieldContext`.
 * Must be used inside a `form.AppField` render prop.
 *
 * Supports a render prop `children` for dependent content that should appear
 * or change based on the selected value.
 *
 * @see useFieldContext for field component conventions.
 *
 * @example
 * <form.AppField name="partitionSource">
 *   {(field) => (
 *     <field.RadioGroupField
 *       label={_("Partition source")}
 *       options={[
 *         { value: "new", label: _("New partition"), description: _("Create a new partition") },
 *         { value: "reuse", label: _("Use existing"), description: _("Pick an existing partition") },
 *       ]}
 *     >
 *       {(value) => value === "reuse" && <PartitionPicker />}
 *     </field.RadioGroupField>
 *   )}
 * </form.AppField>
 */
export default function RadioGroupField<T extends string>({
  label,
  options,
  helperText,
  children,
}: RadioGroupFieldProps<T>) {
  const field = useFieldContext<T>();
  const error = field.state.meta.errors[0];

  return (
    <FormGroup fieldId={field.name} label={label}>
      <Stack hasGutter>
        {options.map((opt) => (
          <Radio
            key={opt.value}
            id={`${field.name}-${opt.value}`}
            name={field.name}
            value={opt.value}
            isChecked={field.state.value === opt.value}
            onChange={() => field.handleChange(opt.value as T)}
            label={opt.label}
            description={opt.description}
            isDisabled={opt.isDisabled}
          />
        ))}
        {children?.(field.state.value)}
      </Stack>
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
