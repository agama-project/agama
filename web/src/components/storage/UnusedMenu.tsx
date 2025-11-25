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

import React, { forwardRef } from "react";
import { Button, Flex, FlexItem } from "@patternfly/react-core";
import Icon from "~/components/layout/Icon";
import { useNavigate } from "react-router";
import MenuButton, { CustomToggleProps } from "~/components/core/MenuButton";
import { STORAGE as PATHS } from "~/routes/paths";
import { model } from "~/types/storage";
import { generateEncodedPath } from "~/utils";
import { _ } from "~/i18n";

type UnusedMenuProps = { deviceModel: model.Drive | model.MdRaid };

const UnusedMenuToggle = forwardRef(({ ...props }: CustomToggleProps, ref) => {
  const description = _("Not configured yet");

  return (
    <Button variant="link" ref={ref} style={{ display: "inline", width: "fit-content" }} {...props}>
      <Flex
        alignItems={{ default: "alignItemsCenter" }}
        gap={{ default: "gapSm" }}
        flexWrap={{ default: "nowrap" }}
        style={{ whiteSpace: "normal", textAlign: "start" }}
      >
        <FlexItem>{description}</FlexItem>
        <FlexItem>
          <Icon name="keyboard_arrow_down" style={{ verticalAlign: "middle" }} />
        </FlexItem>
      </Flex>
    </Button>
  );
});

export default function UnusedMenu({ deviceModel }: UnusedMenuProps): React.ReactNode {
  const navigate = useNavigate();
  const { list, listIndex } = deviceModel;
  const newPartitionPath = generateEncodedPath(PATHS.addPartition, { list, listIndex });
  const formatDevicePath = generateEncodedPath(PATHS.formatDevice, { list, listIndex });
  const filesystemLabel =
    list === "drives" ? _("Use the disk without partitions") : _("Use the RAID without partitions");

  return (
    <MenuButton
      toggleProps={{
        variant: "plainText",
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
      customToggle={<UnusedMenuToggle />}
    />
  );
}
