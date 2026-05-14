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
import { useFieldContext } from "~/hooks/form-contexts";

import type { TextInputProps } from "@patternfly/react-core";

type TextFieldProps = {
  label: React.ReactNode;
  helperText?: React.ReactNode;
  type?: TextInputProps["type"];
  size?: number;
};

/**
 * A text input tied to a TanStack Form field via `useFieldContext`.
 * Must be used inside a `form.AppField` render prop.
 *
 * @see useFieldContext for field component conventions.
 */
export default function TextField({ label, helperText, type, size }: TextFieldProps) {
  const field = useFieldContext<string>();
  const error = field.state.meta.errors[0];

  return (
    <FormGroup fieldId={field.name} label={label}>
      <TextInput
        id={field.name}
        name={field.name}
        type={type}
        size={size}
        value={field.state.value}
        validated={error ? "error" : "default"}
        onChange={(_, value) => field.handleChange(value)}
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
