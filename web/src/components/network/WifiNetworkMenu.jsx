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
import { DropdownItem } from '@patternfly/react-core';
import { Icon } from "~/components/layout";
import { KebabMenu } from "~/components/core";
import { useInstallerClient } from "~/context/installer";
import { _ } from "~/i18n";

export default function WifiNetworkMenu({ settings, position = "right" }) {
  const client = useInstallerClient();

  return (
    <KebabMenu
      position={position}
      className="wifi-network-menu"
      items={[
        <DropdownItem
          key="forget-network"
          onClick={() => client.network.deleteConnection(settings)}
          icon={<Icon name="delete" size="24" />}
          className="danger-action"
        >
          {/* TRANSLATORS: menu label, remove the selected WiFi network settings */}
          {_("Forget network")}
        </DropdownItem>
      ]}
    />
  );
}
