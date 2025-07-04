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
import { Divider, Flex } from "@patternfly/react-core";
import { useNavigate, generatePath } from "react-router-dom";
import Text from "~/components/core/Text";
import Link from "~/components/core/Link";
import MenuButton from "~/components/core/MenuButton";
import MountPathMenuItem from "~/components/storage/MountPathMenuItem";
import { Partition } from "~/api/storage/types/model";
import { STORAGE as PATHS } from "~/routes/paths";
import { useDeletePartition } from "~/hooks/storage/partition";
import * as driveUtils from "~/components/storage/utils/drive";
import { sprintf } from "sprintf-js";
import { _ } from "~/i18n";

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

export default function PartitionsMenu({ device }) {
  const navigate = useNavigate();
  const ariaLabelId = useId();
  const toggleTextId = useId();
  const { isBoot, isTargetDevice: hasPv, list, listIndex } = device;
  const newPartitionPath = generatePath(PATHS.addPartition, { list, listIndex });
  const isAdditional = isBoot || hasPv;
  const addContentLabel = isAdditional ? _("No additional content yet") : _("No content yet");
  const moreContentLabel = isAdditional ? _("Additional content") : _("Content");
  const moreContentAriaLabel = sprintf(
    isAdditional ? _("Additional content for %s") : _("Content for %s"),
    device.name,
  );

  const hasDefinedContent = device.partitions.some((p: Partition) => p.mountPath);

  if (!hasDefinedContent) {
    return (
      <Flex gap={{ default: "gapXs" }}>
        <Text isBold>{addContentLabel}</Text>
        <Link variant="link" isInline to={newPartitionPath}>
          {_("Add a new partition or mount an existing one")}
        </Link>
      </Flex>
    );
  }

  return (
    <Flex gap={{ default: "gapXs" }}>
      <Text id={ariaLabelId} srOnly>
        {moreContentAriaLabel}
      </Text>
      <Text isBold aria-hidden>
        {moreContentLabel}
      </Text>
      <MenuButton
        menuProps={{
          "aria-label": moreContentAriaLabel,
        }}
        toggleProps={{
          variant: "plainText",
          "aria-labelledby": `${ariaLabelId} ${toggleTextId}`,
        }}
        items={device.partitions
          .filter((p: Partition) => p.mountPath)
          .map((p: Partition) => {
            return <PartitionMenuItem key={p.mountPath} device={device} mountPath={p.mountPath} />;
          })
          .concat(
            <Divider key="divider" component="li" />,
            <MenuButton.Item
              key="add-partition"
              itemId="add-partition"
              description={_("Add another partition or mount an existing one")}
              onClick={() => navigate(newPartitionPath)}
            >
              {_("Add or use partition")}
            </MenuButton.Item>,
          )}
      >
        <Text id={toggleTextId}>{driveUtils.contentDescription(device)}</Text>
      </MenuButton>
    </Flex>
  );
}
