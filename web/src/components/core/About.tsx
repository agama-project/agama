/*
 * Copyright (c) [2022-2023] SUSE LLC
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
import { Button, ButtonProps, Text } from "@patternfly/react-core";
import { Icon } from "~/components/layout";
import { Popup } from "~/components/core";
import { sprintf } from "sprintf-js";
import { _ } from "~/i18n";

export type AboutProps = {
  /** Whether render a "help" icon into the button */
  showIcon?: boolean;
  /** The size for the button icon, if any */
  iconSize?: string;
  /** The text for the button */
  buttonText?: string;
  /** Props for the button, see {@link https://www.patternfly.org/components/button PF/Button} */
  buttonProps?: ButtonProps;
} & ButtonProps;

/**
 * Renders a button and a dialog to allow user read about what Agama is
 */
export default function About({
  showIcon = true,
  iconSize = "s",
  buttonText = _("About"),
  buttonProps = { variant: "link" },
}: AboutProps) {
  const [isOpen, setIsOpen] = useState(false);

  const open = () => setIsOpen(true);
  const close = () => setIsOpen(false);

  return (
    <>
      <Button
        icon={showIcon && <Icon name="help" size={iconSize} />}
        onClick={open}
        {...buttonProps}
      >
        {buttonText}
      </Button>

      <Popup isOpen={isOpen} title={_("About Agama")}>
        <Text>
          {
            // TRANSLATORS: content of the "About" popup (1/2)
            _(
              "Agama is an experimental installer for (open)SUSE systems. It \
is still under development so, please, do not use it in \
production environments. If you want to give it a try, we \
recommend using a virtual machine to prevent any possible \
data loss.",
            )
          }
        </Text>
        <Text>
          {sprintf(
            // TRANSLATORS: content of the "About" popup (2/2)
            // %s is replaced by the project URL
            _("For more information, please visit the project's repository at %s."),
            "https://github.com/openSUSE/agama",
          )}
        </Text>
        <Popup.Actions>
          <Popup.Confirm onClick={close} autoFocus>
            {_("Close")}
          </Popup.Confirm>
        </Popup.Actions>
      </Popup>
    </>
  );
}
