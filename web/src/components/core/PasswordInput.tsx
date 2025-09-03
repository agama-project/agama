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
  FormHelperText,
  InputGroup,
  InputGroupItem,
  TextInput,
  TextInputProps,
} from "@patternfly/react-core";
import { _ } from "~/i18n";
import { Icon } from "~/components/layout";
import { useInstallerL10n } from "~/context/installerL10n";
import { sprintf } from "sprintf-js";
import { useKeyLock } from "~/hooks/use-key-lock";
import { localConnection } from "~/utils";
import textStyles from "@patternfly/react-styles/css/utilities/Text/text";

/**
 * Types of keyboard-related reminders to the user.
 *   "keymap": Reminder about the current keyboard layout in use.
 *   "capslock": Warning that Caps Lock is enabled.
 */
type KeyboardReminders = "keymap" | "capslock";

/**
 * Props matching the {@link https://www.patternfly.org/components/forms/text-input PF/TextInput},
 * except `type` that will be forced to 'password'.
 */
export type PasswordInputProps = Omit<TextInputProps, "type"> & {
  inputRef?: React.Ref<HTMLInputElement>;
  reminders?: KeyboardReminders[];
};

/**
 * Displays a text about keyboard layout is use, unless in remote connection
 */
const KeymapReminder = () => {
  const { keymap } = useInstallerL10n();

  if (!localConnection()) return;

  const [textStart, layout, textEnd] = sprintf(
    // TRANSLATORS: Message to inform users which keyboard layout is active. %s
    // will be replaced with the layout name (e.g., "de", "cn", "cz"). Keep
    // square brackets around %s to apply special formatting in
    // the UI.
    _("Using [%s] keyboard"),
    keymap,
  ).split(/[[\]]/);

  return (
    <span>
      {textStart} <code className={textStyles.fontWeightBold}>{layout}</code> {textEnd}
    </span>
  );
};

/**
 * Displays a message when Caps Lock is active.
 */
const CapsLockReminder = () => {
  const isCapsLockOn = useKeyLock("CapsLock");

  if (!isCapsLockOn) return;

  // TRANSLATORS: Warns users that CAPS LOCK is on.
  // Keep square brackets to apply special formatting in the UI.
  const [textStart, capsLock, textEnd] = _("[CAPS LOCK] is on").split(/[[\]]/);

  return (
    <span className={textStyles.textColorStatusDanger}>
      {textStart} <b className={textStyles.fontWeightBold}>{capsLock}</b> {textEnd}
    </span>
  );
};

/**
 * Shows one or more keyboard-related reminders based on the provided list.
 * Used below the password input to help prevent typing issues.
 */
const Reminders = ({ display = [] }: { display: KeyboardReminders[] }) => {
  if (display.length === 0) return;

  return (
    <FormHelperText>
      {display.includes("keymap") && <KeymapReminder />}
      {display.includes("capslock") && <CapsLockReminder />}
    </FormHelperText>
  );
};

/**
 * A password input field with a toggle button to show or hide the password, and
 * optional keyboard-related reminders.
 */
export default function PasswordInput({
  id,
  inputRef,
  reminders = ["keymap", "capslock"],
  ...props
}: PasswordInputProps) {
  const [showPassword, setShowPassword] = useState(false);
  const visibilityIconName = showPassword ? "visibility_off" : "visibility";

  if (!id) {
    const field = props.label || props["aria-label"] || props.name;
    console.error(
      `The PasswordInput component must have an 'id' but it was not given for '${field}'`,
    );
  }

  return (
    <>
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
      <Reminders display={reminders} />
    </>
  );
}
