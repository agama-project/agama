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
import Icon from "~/components/layout/Icon";
import ConfigEditorItem from "~/components/storage/ConfigEditorItem";
import MdRaidHeader from "~/components/storage/MdRaidHeader";
import DeviceEditorContent from "~/components/storage/DeviceEditorContent";
import SearchedDeviceMenu from "~/components/storage/SearchedDeviceMenu";
import { CustomToggleProps } from "~/components/core/MenuButton";
import { useDeleteMdRaid } from "~/hooks/storage/md-raid";
import { Button, Flex, FlexItem } from "@patternfly/react-core";
import textStyles from "@patternfly/react-styles/css/utilities/Text/text";
import { useMdRaid } from "~/hooks/storage/model";
import { useDevice } from "~/hooks/model/system/storage";
import type { ConfigModel } from "~/model/storage";
import type { storage } from "~/model/system";

type MdRaidDeviceMenuProps = {
  raid: ConfigModel.MdRaid;
  selected: storage.Device;
};

type MdRaidDeviceMenuToggleProps = CustomToggleProps & {
  raid: ConfigModel.MdRaid;
  device: storage.Device;
};

const MdRaidDeviceMenuToggle = forwardRef(
  ({ raid, device, ...props }: MdRaidDeviceMenuToggleProps, ref) => {
    return (
      <Button
        variant="link"
        ref={ref}
        style={{ display: "inline", width: "fit-content" }}
        className={[textStyles.fontFamilyHeading, textStyles.fontSizeMd].join(" ")}
        {...props}
      >
        <Flex
          alignItems={{ default: "alignItemsCenter" }}
          gap={{ default: "gapSm" }}
          flexWrap={{ default: "nowrap" }}
          style={{ whiteSpace: "normal", textAlign: "start" }}
        >
          <FlexItem>
            <MdRaidHeader raid={raid} device={device} {...props} />
          </FlexItem>
          <FlexItem>
            <Icon name="keyboard_arrow_down" style={{ verticalAlign: "middle" }} />
          </FlexItem>
        </Flex>
      </Button>
    );
  },
);

/**
 * Internal component that renders generic actions available for an MdRaid device.
 */
const MdRaidDeviceMenu = ({ raid, selected }: MdRaidDeviceMenuProps): React.ReactNode => {
  const deleteMdRaid = useDeleteMdRaid();
  const deleteFn = (device: ConfigModel.MdRaid) => deleteMdRaid(device.name);

  return (
    <SearchedDeviceMenu
      modelDevice={raid}
      selected={selected}
      deleteFn={deleteFn}
      toggle={<MdRaidDeviceMenuToggle raid={raid} device={selected} />}
    />
  );
};

type MdRaidEditorProps = { index: number };

/**
 * Component responsible for displaying detailed information and available
 * actions related to a specific MdRaid device within the storage ConfigEditor.
 */
export default function MdRaidEditor({ index }: MdRaidEditorProps) {
  const raidModel = useMdRaid(index);
  const raid = useDevice(raidModel.name);
  return (
    <ConfigEditorItem header={<MdRaidDeviceMenu raid={raidModel} selected={raid} />}>
      <DeviceEditorContent collection="mdRaids" index={index} />
    </ConfigEditorItem>
  );
}
