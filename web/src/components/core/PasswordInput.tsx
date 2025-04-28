/*
 * Copyright (c) [2023-2025] SUSE LLC
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

import React, { useState } from "react";
import {
  Button,
  HelperText,
  HelperTextItem,
  InputGroup,
  InputGroupItem,
  Stack,
  TextInput,
  TextInputProps,
} from "@patternfly/react-core";
import { _ } from "~/i18n";
import { Icon } from "~/components/layout";
import { useInstallerL10n } from "~/context/installerL10n";
import { sprintf } from "sprintf-js";

const ChangeKeyboardButton = () => (
  <Button
    variant="link"
    isInline
    onClick={() => document.getElementById("language-and-keyboard").click()}
  >
    {_("Change")}
  </Button>
);

/**
 * Props matching the {@link https://www.patternfly.org/components/forms/text-input PF/TextInput},
 * except `type` that will be forced to 'password'.
 */
export type PasswordInputProps = Omit<TextInputProps, "type"> & {
  inputRef?: React.Ref<HTMLInputElement>;
  showKeyboardHint?: boolean;
};

/**
 * Renders a password input field and a toggle button that can be used to reveal
 * and hide the password
 * @component
 *
 */
export default function PasswordInput({
  id,
  inputRef,
  showKeyboardHint = true,
  ...props
}: PasswordInputProps) {
  const { keymap } = useInstallerL10n();
  const [showPassword, setShowPassword] = useState(false);
  const visibilityIconName = showPassword ? "visibility_off" : "visibility";

  if (!id) {
    const field = props.label || props["aria-label"] || props.name;
    console.error(
      `The PasswordInput component must have an 'id' but it was not given for '${field}'`,
    );
  }

  const [keyboardHintStart, keyboard, keyboardHintEnd] = sprintf(
    _("Using [%s] keyboard."),
    keymap,
  ).split(/[[\]]/);

  return (
    <Stack hasGutter>
      {showKeyboardHint && (
        <HelperText>
          <HelperTextItem variant="indeterminate">
            {keyboardHintStart}{" "}
            <code>
              <b>{keyboard}</b>
            </code>{" "}
            {keyboardHintEnd} <ChangeKeyboardButton />
          </HelperTextItem>
        </HelperText>
      )}
      <InputGroup>
        <InputGroupItem isFill>
          <TextInput {...props} ref={inputRef} id={id} type={showPassword ? "text" : "password"} />
        </InputGroupItem>
        <InputGroupItem>
          <Button
            id={`toggle-${id}-visibility`}
            className="password-toggler"
            aria-label={_("Password visibility button")}
            variant="control"
            onClick={() => setShowPassword((prev) => !prev)}
            isDisabled={props.isDisabled}
            isInline
          >
            <Icon name={visibilityIconName} style={{ width: "1em", height: "1em" }} />
          </Button>
        </InputGroupItem>
      </InputGroup>
    </Stack>
  );
}
