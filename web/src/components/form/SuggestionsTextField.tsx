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

type SuggestionsTextFieldProps = {
  label: React.ReactNode;
  helperText?: React.ReactNode;
  suggestions?: string[];
  onSelect?: (value: string) => void;
};

/**
 * A text input with native datalist suggestions for TanStack Form.
 * Must be used inside a form.AppField render prop.
 *
 * Uses HTML datalist for browser-native autocomplete behavior.
 * User can type freely; suggestions are optional.
 *
 * ## onSelect callback
 *
 * The `onSelect` callback is called when a suggestion is selected (via click or Enter key).
 * It does NOT fire when the user manually types the same value character by character.
 *
 * **Detection mechanism:**
 * - Tracks previous value in a ref
 * - When onChange fires with a new value that matches a suggestion, triggers onSelect
 * - This distinguishes selection from incremental typing
 *
 * **Use case:**
 * Use `onSelect` when you need instant feedback for complete values (e.g., updating
 * derived fields) but want to defer reactions while the user is still typing.
 *
 * @example
 * <field.SuggestionsTextField
 *   suggestions={["/home", "/var", "swap"]}
 *   onSelect={(value) => {
 *     // React immediately when user selects "/home" from dropdown
 *     form.setFieldValue("derivedField", computeFromMountPoint(value));
 *   }}
 * />
 *
 * @see useFieldContext for field component conventions.
 */
export default function SuggestionsTextField({
  label,
  helperText,
  suggestions = [],
  onSelect,
}: SuggestionsTextFieldProps) {
  const field = useFieldContext<string>();
  const error = field.state.meta.errors[0];
  const datalistId = `${field.name}-datalist`;
  const prevValueRef = React.useRef(field.state.value);

  return (
    <FormGroup fieldId={field.name} label={label}>
      <TextInput
        id={field.name}
        name={field.name}
        type="text"
        list={datalistId}
        value={field.state.value}
        validated={error ? "error" : "default"}
        onChange={(_, value) => {
          field.handleChange(value);
          // Detect suggestion selection: value changed AND matches a suggestion
          if (onSelect && value !== prevValueRef.current && suggestions.includes(value)) {
            onSelect(value);
          }
          prevValueRef.current = value;
        }}
        onBlur={() => field.handleBlur()}
      />
      <datalist id={datalistId}>
        {suggestions.map((suggestion, index) => (
          <option key={`${suggestion}-${index}`} value={suggestion} />
        ))}
      </datalist>
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
