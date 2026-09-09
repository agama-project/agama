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
 * To contact SUSE LLC about this file by physical or electronic mail, you may
 * find current contact information at www.suse.com.
 */

import React from "react";
import { Button, ButtonProps, Flex } from "@patternfly/react-core";
import Icon from "~/components/layout/Icon";
import { useTerminal } from "~/context/terminal";
import { _ } from "~/i18n";

/**
 * Terminal toggle button component
 *
 * A pre-configured button that opens or closes the terminal panel, for
 * screens that do not render InstallerOptionsMenu (which already includes
 * this same action for the screens that do).
 *
 * The button is styled as a plain variant and includes a terminal icon, and
 * its label reflects whether the panel is currently open.
 */
export default function TerminalToggleButton(props: Omit<ButtonProps, "onClick">) {
  const { isOpen, toggle } = useTerminal();
  const label = isOpen ? _("Close terminal") : _("Open terminal");

  return (
    <Button variant="plain" size="default" {...props} onClick={toggle}>
      <Flex gap={{ default: "gapXs" }} alignItems={{ default: "alignItemsCenter" }}>
        <Icon name="terminal" /> {label}
      </Flex>
    </Button>
  );
}
