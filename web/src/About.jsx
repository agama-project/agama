/*
 * Copyright (c) [2022] SUSE LLC
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
import { Button, Text } from "@patternfly/react-core";
import Popup from "./Popup";

export default function About() {
  const [isOpen, setIsOpen] = useState(false);

  const open = () => setIsOpen(true);
  const close = () => setIsOpen(false);

  return (
    <>
      <Button variant="link" onClick={open}>
        About
      </Button>

      <Popup
        isOpen={isOpen}
        title="About D-Installer"
        autoFocusOn="confirm"
        onConfirm={close}
        confirmText="Close"
      >
        <Text>
          D-Installer is an <strong>experimental installer</strong> for (open)SUSE systems. It is
          still under development so, please, do not use it in production environments. If you want
          to give it a try, we recommend to use a virtual machine to prevent any possible data loss.
        </Text>
        <Text>
          For more information, check{" "}
          <a href="https://github.com/yast/d-installer">the project's repository</a>.
        </Text>
      </Popup>
    </>
  );
}
