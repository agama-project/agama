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
import Popup from "./Popup";
import { Button, Text } from "@patternfly/react-core";

import NMOverview from "./NetworkManager";

export default function Ip() {
  const [isOpen, setIsOpen] = useState(false);

  const open = () => setIsOpen(true);
  const close = () => setIsOpen(false);

  return (
    <>
      <Button variant="link" onClick={open}>
        <NMOverview />
      </Button>

      <Popup
        isOpen={isOpen}
        title="Hostname"
      >
        <Text>
          IP1<br />
          IP2<br />
          ...<br />
          IPn<br />
        </Text>
        <Popup.Actions>
          <Popup.Confirm onClick={close} autoFocus>Close</Popup.Confirm>
        </Popup.Actions>
      </Popup>
    </>
  );
}
