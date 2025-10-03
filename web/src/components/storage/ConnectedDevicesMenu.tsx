/*
 * Copyright (c) [2024-2025] SUSE LLC
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

import React from "react";
import { useNavigate } from "react-router-dom";
import { _ } from "~/i18n";
import { useReactivateSystem } from "~/hooks/storage/system";
import { STORAGE as PATHS } from "~/routes/paths";
import { useZFCPSupported } from "~/queries/storage/zfcp";
import { useDASDSupported } from "~/queries/storage/dasd";
import { Icon } from "~/components/layout";
import MenuButton from "../core/MenuButton";
import spacingStyles from "@patternfly/react-styles/css/utilities/Spacing/spacing";

export default function ConnectedDevicesMenu() {
  const navigate = useNavigate();
  const isZFCPSupported = useZFCPSupported();
  const isDASDSupported = useDASDSupported();
  const reactivate = useReactivateSystem();

  return (
    <MenuButton
      menuProps={{
        popperProps: {
          position: "end",
        },
      }}
      toggleProps={{
        variant: "plain",
        className: spacingStyles.p_0,
        // TRANSLATORS: this is an ARIA (accesibility) description of an UI element
        "aria-label": _("More storage options"),
      }}
      items={[
        <MenuButton.Item
          key="iscsi-link"
          onClick={() => navigate(PATHS.iscsi)}
          description={_("Discover and connect to iSCSI targets")}
        >
          {_("Configure iSCSI")}
        </MenuButton.Item>,
        isZFCPSupported && (
          <MenuButton.Item
            key="zfcp-link"
            onClick={() => navigate(PATHS.zfcp.root)}
            description={_("Activate zFCP disks")}
          >
            {_("Configure zFCP")}
          </MenuButton.Item>
        ),
        isDASDSupported && (
          <MenuButton.Item
            key="dasd-link"
            onClick={() => navigate(PATHS.dasd)}
            description={_("Activate and format DASD devices")}
          >
            {_("Configure DASD")}
          </MenuButton.Item>
        ),
        <MenuButton.Item
          key="reprobe-link"
          onClick={reactivate}
          description={_("Update available disks and activate crypt devices")}
        >
          {_("Rescan devices")}
        </MenuButton.Item>,
      ]}
    >
      <Icon name="more_horiz" className="agm-three-dots-icon" />
    </MenuButton>
  );
}
