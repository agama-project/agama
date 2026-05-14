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

import React, { useState } from "react";
import {
  Button,
  Flex,
  FormGroup,
  FormHelperText,
  HelperText,
  HelperTextItem,
  InputGroup,
  InputGroupItem,
  TextInput,
} from "@patternfly/react-core";
import { Icon } from "~/components/layout";
import Interpolate from "~/components/core/Interpolate";
import Text from "~/components/core/Text";
import { useFieldContext } from "~/hooks/form-contexts";
import { useInstallerL10n } from "~/context/installerL10n";
import { useKeyLock } from "~/hooks/use-key-lock";
import { localConnection } from "~/utils";
import { _ } from "~/i18n";

/**
 * Types of keyboard reminders that can be shown for a masked field.
 */
export type ReminderType = "keymap" | "capslock";

/**
 * Props for the `MaskedField` component.
 */
export type MaskedFieldProps = {
  /** Label to display above the input */
  label: React.ReactNode;
  /** Optional helper text displayed below the input */
  helperText?: React.ReactNode;
  /** Optional size of the input field */
  size?: number;
  /**
   * Optional prop for hiding specific reminders.
   * It expect an array of reminders to hide.
   */
  hideReminders?: ReminderType[];
};

/**
 * Displays the current keyboard layout if available and connected locally.
 */
const KeymapReminder = () => {
  const { keymap } = useInstallerL10n();

  if (!localConnection()) return;

  return (
    <span>
      <Interpolate
        sentence={
          /*
           * TRANSLATORS: Message to inform users which keyboard layout is active
           * %s will be replaced with the keyboard layout name (e.g., "US", "DE").
           * Example: "Using us keyboard".
           */
          _("Using %s keyboard layout")
        }
      >
        {() => (
          <Text isBold textStyle={"fontFamilyMonospace"}>
            {keymap}
          </Text>
        )}
      </Interpolate>
    </span>
  );
};

/**
 * Displays a warning if Caps Lock is currently active.
 */
const CapsLockReminder = () => {
  const isCapsLockOn = useKeyLock("CapsLock");

  if (!isCapsLockOn) return;

  return (
    <Text textStyle={"textColorStatusDanger"}>
      <Interpolate
        sentence={
          /*
           * TRANSLATORS: Warns users that CAPS LOCK is on.
           * Text inside square brackets [] will be formatted in bold.
           * Keep the brackets for proper formatting.
           */
          _("[CAPS LOCK] is on")
        }
      >
        {(text) => <Text isBold>{text}</Text>}
      </Interpolate>
    </Text>
  );
};

/**
 * Displays the keyboard and Caps Lock reminders for a field.
 */
const Reminders = ({ hideReminders = [] }: { hideReminders?: ReminderType[] }) => {
  const showKeymap = !hideReminders.includes("keymap");
  const showCapslock = !hideReminders.includes("capslock");

  if (!showKeymap && !showCapslock) return null;

  return (
    <FormHelperText>
      <Flex gap={{ default: "gapXs" }}>
        {showKeymap && <KeymapReminder />}
        {showCapslock && <CapsLockReminder />}
      </Flex>
    </FormHelperText>
  );
};

/**
 * A masked input with show/hide toggle tied to a TanStack Form field via
 * `useFieldContext`. Must be used inside a `form.AppField` render prop.
 *
 * Useful for sensitive values like registration codes, API keys, or tokens
 * that should be hidden by default but allow the user to reveal them.
 *
 * Shows keyboard reminders by default (keymap and Caps Lock warnings).
 * Use `hideReminders` to selectively hide them.
 *
 * @see useFieldContext for field component conventions.
 */
export default function MaskedField({
  label,
  helperText,
  size,
  hideReminders = [],
}: MaskedFieldProps) {
  const field = useFieldContext<string>();
  const error = field.state.meta.errors[0];
  const [showValue, setShowValue] = useState(false);
  const visibilityIconName = showValue ? "visibility_off" : "visibility";

  return (
    <FormGroup fieldId={field.name} label={label}>
      <InputGroup>
        <InputGroupItem isFill>
          <TextInput
            id={field.name}
            name={field.name}
            type={showValue ? "text" : "password"}
            size={size}
            value={field.state.value}
            validated={error ? "error" : "default"}
            onChange={(_, value) => field.handleChange(value)}
          />
        </InputGroupItem>
        <InputGroupItem>
          <Button
            variant="control"
            aria-label={_("Password visibility button")}
            onClick={() => setShowValue((prev) => !prev)}
            isInline
          >
            <Icon name={visibilityIconName} style={{ width: "1em", height: "1em" }} />
          </Button>
        </InputGroupItem>
      </InputGroup>
      <Reminders hideReminders={hideReminders} />
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
