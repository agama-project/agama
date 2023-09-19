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

import React, { useState } from "react";
import {
  Button,
  InputGroup,
  TextInput
} from "@patternfly/react-core";
import { Icon } from "~/components/layout";
import { _ } from "~/i18n";

export default function PasswordInput(props) {
  const [showPassword, setShowPassword] = useState(false);
  const visibilityIconName = showPassword ? "visibility_off" : "visibility";

  return (
    <InputGroup>
      <TextInput
        {...props}
        type={showPassword ? 'text' : 'password'}
      />
      <Button
        id={`toggle-${props.id}-visibility`}
        className="password-toggler"
        aria-label={_("Password visibility button")}
        variant="control"
        onClick={() => setShowPassword((prev) => !prev)}
        icon={<Icon name={visibilityIconName} size="15" />}
        isDisabled={props.isDisabled}
      />
    </InputGroup>
  );
}
