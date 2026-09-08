/*
 * Copyright (c) [2022-2026] SUSE LLC
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
import {
  EmptyState,
  EmptyStateBody,
  EmptyStateFooter,
  Split,
  SplitItem,
} from "@patternfly/react-core";
import { Link } from "~/components/core/";
import Icon from "~/components/layout/Icon";
import { useSystem as useDASDSystem } from "~/hooks/model/system/dasd";
import { useSystem as useZFCPSystem } from "~/hooks/model/system/zfcp";
import { STORAGE as PATHS } from "~/routes/paths";
import { _ } from "~/i18n";

/**
 * Shown instead of the page when the installation has no disk to work with.
 *
 * Offers the ways of making one appear that this machine actually has: iSCSI
 * always, zFCP and DASD only where the system supports them.
 */
export default function NoDevicesMessage(): React.ReactNode {
  const dasdSystem = useDASDSystem();
  const zfcpSystem = useZFCPSystem();

  const description = _(
    "There are not disks available for the installation. You may need to configure some device.",
  );

  return (
    <EmptyState
      headingLevel="h2"
      titleText={_("No devices found")}
      icon={() => <Icon name="error" />}
      status="warning"
    >
      <EmptyStateBody>{description}</EmptyStateBody>
      <EmptyStateFooter>
        <Split hasGutter>
          <SplitItem>
            <Link to={PATHS.iscsi.root} variant="link">
              {_("Connect to iSCSI targets")}
            </Link>
          </SplitItem>
          {zfcpSystem && (
            <SplitItem>
              <Link to={PATHS.zfcp.root} variant="link">
                {_("Activate zFCP disks")}
              </Link>
            </SplitItem>
          )}
          {dasdSystem && (
            <SplitItem>
              <Link to={PATHS.dasd} variant="link">
                {_("Manage DASD devices")}
              </Link>
            </SplitItem>
          )}
        </Split>
      </EmptyStateFooter>
    </EmptyState>
  );
}
