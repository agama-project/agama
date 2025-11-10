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

import React, { useId } from "react";
import { Flex } from "@patternfly/react-core";
import { useNavigate } from "react-router";
import Text from "~/components/core/Text";
import MenuButton from "~/components/core/MenuButton";
import { STORAGE as PATHS } from "~/routes/paths";
import { model } from "~/types/storage";
import { generateEncodedPath } from "~/utils";
import { sprintf } from "sprintf-js";
import { _ } from "~/i18n";

type UnusedMenuProps = { deviceModel: model.Drive | model.MdRaid };

export default function UnusedMenu({ deviceModel }: UnusedMenuProps): React.ReactNode {
  const navigate = useNavigate();
  const ariaLabelId = useId();
  const toggleTextId = useId();
  const { list, listIndex } = deviceModel;
  const newPartitionPath = generateEncodedPath(PATHS.addPartition, { list, listIndex });
  const formatDevicePath = generateEncodedPath(PATHS.formatDevice, { list, listIndex });

  // TRANSLATORS: %s is the name of device, like '/dev/sda'.
  const detailsAriaLabel = sprintf(_("Details for %s"), deviceModel.name);
  const description = _("Not configured yet");
  const filesystemLabel =
    list === "drives" ? _("Use the disk without partitions") : _("Use the RAID without partitions");

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
        items={[
          <MenuButton.Item
            key="add-partition"
            itemId="add-partition"
            description={_("Add a partition or mount an existing one")}
            onClick={() => navigate(newPartitionPath)}
          >
            {_("Add or use partition")}
          </MenuButton.Item>,
          <MenuButton.Item
            key="filesystem"
            itemId="filesystem"
            description={_("Format the whole device or mount an existing file system")}
            onClick={() => navigate(formatDevicePath)}
          >
            {filesystemLabel}
          </MenuButton.Item>,
        ]}
      >
        <Text id={toggleTextId}>{description}</Text>
      </MenuButton>
    </Flex>
  );
}
