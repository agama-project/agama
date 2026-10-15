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
 * You should have received a copy of the GNU General Public License along
 * with this program; if not, contact SUSE LLC.
 *
 * To contact SUSE LLC about this file by physical or electronic mail, you may
 * find current contact information at www.suse.com.
 */

import React from "react";
import { Stack, Flex, FlexItem } from "@patternfly/react-core";
import ConfigureDeviceMenu from "~/components/storage/ConfigureDeviceMenu";
import ChangeInstallationDisk from "~/components/storage/storage-page/ChangeInstallationDisk";
import { _ } from "~/i18n";
import { useConfigModel } from "~/hooks/model/storage/config-model";
import configModel from "~/model/storage/config-model";

/**
 * Controls that act on the storage configuration as a whole, rather than on a
 * single entry of it.
 *
 * Adding more devices is always offered. Where the installation uses a single
 * disk that can be swapped, changing that disk is offered too.
 */
export default function GlobalActions() {
  const config = useConfigModel();
  const canChangeTarget = configModel.canChangeTargetDrive(config);

  return (
    <Stack hasGutter>
      {canChangeTarget && (
        <Flex
          gap={{ default: "gapSm" }}
          alignItems={{ default: "alignItemsCenter" }}
          justifyContent={{ default: "justifyContentCenter" }}
          flexWrap={{ default: "wrap" }}
        >
          <ChangeInstallationDisk />
          <ConfigureDeviceMenu
            // TRANSLATORS: offered at the foot of the list of what the
            // installation is made of: bring more disks into it.
            label={_("Add more devices")}
            popperProps={{ position: "right" }}
          />
        </Flex>
      )}
      {!canChangeTarget && (
        <Flex className="agm-entries-table__add">
          <FlexItem>
            <ConfigureDeviceMenu
              // TRANSLATORS: offered at the foot of the list of what the
              // installation is made of: bring more disks into it.
              label={_("Add more devices")}
              popperProps={{ position: "left" }}
            />
          </FlexItem>
        </Flex>
      )}
    </Stack>
  );
}
