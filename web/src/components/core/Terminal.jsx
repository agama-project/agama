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
import { Popup } from "~/components/core";
import { _ } from "~/i18n";

export default function Terminal({ onCloseCallback }) {
  // the popup is visible
  const [isOpen, setIsOpen] = useState(true);

  const close = () => {
    setIsOpen(false);
    if (onCloseCallback) onCloseCallback();
  };

  // embed the cockpit terminal into an iframe, see
  // https://cockpit-project.org/guide/latest/embedding.html#embedding-components
  // https://cockpit-project.org/guide/latest/api-terminal-html.html
  return (
    <Popup
      isOpen={isOpen}
      aria-label="terminal popup"
      blockSize="large"
      inlineSize="large"
    >

      <iframe className="vertically-centered" src="/cockpit/@localhost/system/terminal.html" />

      <Popup.Actions>
        <Popup.Confirm onClick={close} autoFocus>{_("Close")}</Popup.Confirm>
      </Popup.Actions>
    </Popup>
  );
}
