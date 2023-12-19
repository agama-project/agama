/*
 * Copyright (c) [2023] SUSE LLC
 *
 * All Rights Reserved.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of version 2 of the GNU General Public License as published
 * by the Free Software Foundation.
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

/**
 * Renders a password input field and a toggle button that can be used to reveal
 * and hide the password
 * @component
 *
 * @param {string} id - the identifier for the field.
 * @param {Object} props - props matching the {@link https://www.patternfly.org/components/forms/text-input PF/TextInput},
 *                         except `type` that will be ignored.
 */
import React, { useState } from "react";
import {
  Button,
  InputGroup,
  TextInput
} from "@patternfly/react-core";
import { Icon } from "~/components/layout";
import { _ } from "~/i18n";

export default function PasswordInput({ id, ...props }) {
  const [showPassword, setShowPassword] = useState(false);
  const visibilityIconName = showPassword ? "visibility_off" : "visibility";

  if (!id) {
    const field = props.label || props["aria-label"] || props.name;
    console.error(`The PasswordInput component must have an 'id' but it was not given for '${field}'`);
  }

  return (
    <InputGroup>
      <TextInput
        {...props}
        id={id}
        type={showPassword ? 'text' : 'password'}
      />
      <Button
        id={`toggle-${id}-visibility`}
        className="password-toggler"
        aria-label={_("Password visibility button")}
        variant="control"
        onClick={() => setShowPassword((prev) => !prev)}
        icon={<Icon name={visibilityIconName} size="xxs" />}
        isDisabled={props.isDisabled}
      />
    </InputGroup>
  );
}
