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
import { useNavigate, generatePath } from "react-router-dom";
import { _ } from "~/i18n";
import { STORAGE as PATHS } from "~/routes/paths";
import { useDeletePartition } from "~/hooks/storage/partition";
import * as driveUtils from "~/components/storage/utils/drive";
import DeviceMenu from "~/components/storage/DeviceMenu";
import MountPathMenuItem from "~/components/storage/MountPathMenuItem";
import { Divider, Flex, MenuItem, MenuList } from "@patternfly/react-core";

const PartitionsNoContentSelector = ({ device, toggleAriaLabel }) => {
  const navigate = useNavigate();
  const { list, listIndex } = device;

  return (
    <DeviceMenu
      title={<span aria-hidden>{_("No additional partitions will be created")}</span>}
      ariaLabel={toggleAriaLabel}
    >
      <MenuList>
        <MenuItem
          key="add-partition"
          itemId="add-partition"
          description={_("Add another partition or mount an existing one")}
          role="menuitem"
          onClick={() => navigate(generatePath(PATHS.addPartition, { list, listIndex }))}
        >
          <Flex component="span" justifyContent={{ default: "justifyContentSpaceBetween" }}>
            <span>{_("Add or use partition")}</span>
          </Flex>
        </MenuItem>
      </MenuList>
    </DeviceMenu>
  );
};

const PartitionMenuItem = ({ device, mountPath }) => {
  const partition = device.getPartition(mountPath);
  const { list, listIndex } = device;
  const partitionId = encodeURIComponent(mountPath);
  const editPath = generatePath(PATHS.editPartition, { list, listIndex, partitionId });
  const deletePartition = useDeletePartition();

  return (
    <MountPathMenuItem
      device={partition}
      editPath={editPath}
      deleteFn={() => deletePartition(list, listIndex, mountPath)}
    />
  );
};

const PartitionsWithContentSelector = ({ device, toggleAriaLabel }) => {
  const navigate = useNavigate();
  const { list, listIndex } = device;

  return (
    <DeviceMenu
      title={<span aria-hidden>{driveUtils.contentDescription(device)}</span>}
      ariaLabel={toggleAriaLabel}
    >
      <MenuList>
        {device.partitions
          .filter((p) => p.mountPath)
          .map((partition) => {
            return (
              <PartitionMenuItem
                key={partition.mountPath}
                device={device}
                mountPath={partition.mountPath}
              />
            );
          })}
        <Divider component="li" />
        <MenuItem
          key="add-partition"
          itemId="add-partition"
          description={_("Add another partition or mount an existing one")}
          onClick={() => navigate(generatePath(PATHS.addPartition, { list, listIndex }))}
        >
          <Flex component="span" justifyContent={{ default: "justifyContentSpaceBetween" }}>
            <span>{_("Add or use partition")}</span>
          </Flex>
        </MenuItem>
      </MenuList>
    </DeviceMenu>
  );
};

export default function PartitionsMenu({ device }) {
  if (device.partitions.some((p) => p.mountPath)) {
    return <PartitionsWithContentSelector device={device} toggleAriaLabel={_("Partitions")} />;
  }

  return <PartitionsNoContentSelector device={device} toggleAriaLabel={_("Partitions")} />;
}
