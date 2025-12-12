/*
 * Copyright (c) [2025] SUSE LLC
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
import { Flex } from "@patternfly/react-core";
import { MenuButtonItem } from "~/components/core/MenuButton";
import { useConvertToVolumeGroup } from "~/hooks/storage/volume-group";
import { deviceBaseName, formattedPath } from "~/components/storage/utils";
import { sprintf } from "sprintf-js";
import { _, n_, formatList } from "~/i18n";
import { useConfigModel } from "~/hooks/model/storage";
import partitionableModel from "~/model/storage/partitionable-model";
import type { ConfigModel } from "~/model/storage/config-model";

export type NewVgMenuOptionProps = { device: ConfigModel.Drive | ConfigModel.MdRaid };

export default function NewVgMenuOption({ device }: NewVgMenuOptionProps): React.ReactNode {
  const config = useConfigModel();
  const convertToVg = useConvertToVolumeGroup();

  if (device.filesystem) return;

  const vgs = partitionableModel.filterVolumeGroups(device, config);
  const paths = device.partitions.filter((p) => !p.name).map((p) => formattedPath(p.mountPath));
  const displayName = deviceBaseName(device, true);

  const titleText = () => {
    if (vgs.length) {
      // TRANSLATORS: %s is the short name of a disk, like 'sda'
      return sprintf(_("Create another LVM volume group on %s"), displayName);
    }

    // TRANSLATORS: %s is the short name of a disk, like 'sda'
    return sprintf(_("Create LVM volume group on %s"), displayName);
  };

  const descriptionText = () => {
    if (paths.length) {
      return sprintf(
        n_(
          // TRANSLATORS: %s is a list of formatted mount points like '"/", "/var" and "swap"' (or a
          // single mount point in the singular case).
          "%s will be created as a logical volume",
          "%s will be created as logical volumes",
          paths.length,
        ),
        formatList(paths),
      );
    }
  };

  return (
    <MenuButtonItem
      component="a"
      onClick={() => convertToVg(device.name)}
      itemId="lvm"
      description={descriptionText()}
    >
      <Flex component="span" justifyContent={{ default: "justifyContentSpaceBetween" }}>
        <span>{titleText()}</span>
      </Flex>
    </MenuButtonItem>
  );
}
