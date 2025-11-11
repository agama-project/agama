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

import React, { useId } from "react";
import { Divider, Stack, Flex } from "@patternfly/react-core";
import { generatePath, useNavigate } from "react-router";
import Text from "~/components/core/Text";
import MenuButton from "~/components/core/MenuButton";
import MenuHeader from "~/components/core/MenuHeader";
import MountPathMenuItem from "~/components/storage/MountPathMenuItem";
import { Partition } from "~/api/storage/types/model";
import { STORAGE as PATHS } from "~/routes/paths";
import { useDeletePartition } from "~/hooks/storage/partition";
import * as driveUtils from "~/components/storage/utils/drive";
import { sprintf } from "sprintf-js";
import { _, n_ } from "~/i18n";

const PartitionMenuItem = ({ device, mountPath }) => {
  const partition = device.getPartition(mountPath);
  const { list, listIndex } = device;
  const editPath = generatePath(PATHS.editPartition, {
    list,
    listIndex,
    partitionId: mountPath,
  });
  const deletePartition = useDeletePartition();

  return (
    <MountPathMenuItem
      device={partition}
      editPath={editPath}
      deleteFn={() => deletePartition(list, listIndex, mountPath)}
    />
  );
};

const partitionsLabelText = (device) => {
  const { isBoot, isTargetDevice, isAddingPartitions, isReusingPartitions } = device;
  const num = device.partitions.filter((p: Partition) => p.mountPath).length;

  if (isBoot || isTargetDevice) {
    if (isAddingPartitions && isReusingPartitions)
      return _("Moreover, the following partitions will be created or mounted");

    if (isAddingPartitions)
      return n_(
        "Moreover, the following partition will be created.",
        "Moreover, the following partitions will be created.",
        num,
      );

    return n_(
      "Moreover, the following partition will be mounted.",
      "Moreover, the following partitions will be mounted.",
      num,
    );
  }

  if (isAddingPartitions && isReusingPartitions)
    return _("The following partitions will be created or mounted");

  if (isAddingPartitions)
    return n_(
      "The following partition will be created.",
      "The following partitions will be created.",
      num,
    );

  return n_(
    "The following partition will be mounted.",
    "The following partitions will be mounted.",
    num,
  );
};

// This function (and maybe the following ones) only makes sense with the current temporary
// organization of the information, see FIXME at PartitionsMenu
const PartitionsMenuHeader = ({ texts, device }) => {
  const hasPartitions = device.partitions.some((p: Partition) => p.mountPath);

  const textsContent = texts.length ? (
    <Stack>
      {texts.map((text, idx) => (
        <span key={idx}>{text}</span>
      ))}
    </Stack>
  ) : null;

  if (textsContent) {
    if (hasPartitions)
      return (
        <MenuHeader
          description={
            <Stack hasGutter>
              {textsContent}
              {partitionsLabelText(device)}
            </Stack>
          }
        />
      );

    return <MenuHeader description={textsContent} />;
  }

  return <MenuHeader description={partitionsLabelText(device)} />;
};

const optionalPartitionsTexts = (device) => {
  const { isBoot, isTargetDevice } = device;

  const texts = [];
  if (isBoot) texts.push(_("Any partition needed to boot will be configured."));
  if (isTargetDevice) texts.push(_('Partitions to host "system" will be created if needed.'));

  return texts;
};

export default function PartitionsMenu({ device }) {
  const navigate = useNavigate();
  const ariaLabelId = useId();
  const toggleTextId = useId();
  const { list, listIndex } = device;
  const newPartitionPath = generatePath(PATHS.addPartition, { list, listIndex });
  // TRANSLATORS: %s is the name of device, like '/dev/sda'.
  const detailsAriaLabel = sprintf(_("Details for %s"), device.name);
  const hasPartitions = device.partitions.some((p: Partition) => p.mountPath);

  // FIXME: All strings and widgets are now calculated and assembled here. But we are actually
  // aiming for a different organization of the widgets (eg. using a MenuGroup with a label to
  // render the list of partition). At that point we will be able to better distribute the logic.

  const optionalTexts = optionalPartitionsTexts(device);
  const items = [];
  if (!!optionalTexts.length || hasPartitions)
    items.push(
      <PartitionsMenuHeader key="header" texts={optionalTexts} device={device} />,
      <Divider key="divider-partitions" component="li" />,
    );

  if (hasPartitions) {
    items.push(
      device.partitions
        .filter((p: Partition) => p.mountPath)
        .map((p: Partition) => {
          return <PartitionMenuItem key={p.mountPath} device={device} mountPath={p.mountPath} />;
        }),
    );
  }

  items.push(
    <MenuButton.Item
      key="add-partition"
      itemId="add-partition"
      description={_("Add another partition or mount an existing one")}
      onClick={() => navigate(newPartitionPath)}
    >
      {_("Add or use partition")}
    </MenuButton.Item>,
  );

  return (
    <Flex gap={{ default: "gapXs" }}>
      <Text id={ariaLabelId} srOnly>
        {detailsAriaLabel}
      </Text>
      <Text isBold aria-hidden>
        {_("Details")}
      </Text>
      <MenuButton
        menuProps={{
          "aria-label": detailsAriaLabel,
        }}
        toggleProps={{
          variant: "plainText",
          "aria-labelledby": `${ariaLabelId} ${toggleTextId}`,
        }}
        items={items}
      >
        <Text id={toggleTextId}>{driveUtils.contentDescription(device)}</Text>
      </MenuButton>
    </Flex>
  );
}
