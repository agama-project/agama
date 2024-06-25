/*
 * Copyright (c) [2022-2023] SUSE LLC
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

// @ts-check

import React, { useState } from "react";
import { useLocation } from "react-router-dom";
import { Button, Card, CardBody, Flex } from "@patternfly/react-core";
import { Icon } from "~/components/layout";
import { Popup } from "~/components/core";
import { InstallerLocaleSwitcher, InstallerKeymapSwitcher } from "~/components/l10n";
import { _ } from "~/i18n";

/**
 * @typedef {import("@patternfly/react-core").ButtonProps} ButtonProps
 */

/**
 * Renders the installer options
 *
 * @todo Write documentation
 */
export default function InstallerOptions() {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  // FIXME: Installer options should be available in the login too.
  if (location.pathname.includes("login")) return;

  const open = () => setIsOpen(true);
  const close = () => setIsOpen(false);

  return (
    <>
      <Button
        variant="plain"
        icon={<Icon name="settings" />}
        onClick={open}
        aria-label={_("Show installer options")}
      />

      <Popup
        isOpen={isOpen}
        title={_("Installer options")}
      >
        <Flex direction={{ default: "column" }} gap={{ default: "gapLg" }}>
          <InstallerLocaleSwitcher />
          <InstallerKeymapSwitcher />
        </Flex>
        <Popup.Actions>
          <Popup.Confirm onClick={close} autoFocus>{_("Close")}</Popup.Confirm>
        </Popup.Actions>
      </Popup>
    </>
  );
}
