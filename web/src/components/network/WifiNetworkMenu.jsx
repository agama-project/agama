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

import React from "react";
import { DropdownItem } from "@patternfly/react-core";
import { DeleteIcon } from "@components/layout/icons";
import { useInstallerClient } from "@context/installer";
import { KebabMenu } from "@components/core";

export default function WifiNetworkMenu({ settings, position = "right" }) {
  const client = useInstallerClient();

  return (
    <KebabMenu
      id={`network-${settings.ssid}-menu`}
      position={position}
      className="wifi-network-menu"
      items={[
        <DropdownItem
          key="forget-network"
          onClick={() => client.network.deleteConnection(settings)}
          icon={<DeleteIcon width="24" height="24" />}
          className="danger-action"
        >
          Forget network
        </DropdownItem>
      ]}
    />
  );
}
