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
import { Button } from "@patternfly/react-core";
import { Center, Icon } from "~/components/layout";
import { Popup, Terminal } from "~/components/core";
import { _ } from "~/i18n";

/**
 * @typedef {import("@patternfly/react-core").ButtonProps} ButtonProps
 */

/**
 * Renders a terminal within a dialog
 *
 * @todo Write documentation
 */
export default function TerminalDialog() {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  if (location.pathname.includes("login")) return;

  const open = () => setIsOpen(true);
  const close = () => setIsOpen(false);

  return (
    <>
      <Button
        variant="plain"
        icon={<Icon name="terminal" />}
        aria-label={_("Show terminal")}
        onClick={open}
      />

      <Popup
        isOpen={isOpen}
        title={_("Terminal")}
      >
        <Terminal />

        <Popup.Actions>
          <Popup.Confirm onClick={close}>{_("Close")}</Popup.Confirm>
        </Popup.Actions>
      </Popup>
    </>
  );
}
