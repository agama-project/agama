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

import React, { forwardRef } from "react";
import Icon from "~/components/layout/Icon";
import ConfigEditorItem from "~/components/storage/ConfigEditorItem";
import DriveHeader from "~/components/storage/DriveHeader";
import DeviceEditorContent from "~/components/storage/DeviceEditorContent";
import SearchedDeviceMenu from "~/components/storage/SearchedDeviceMenu";
import { CustomToggleProps } from "~/components/core/MenuButton";
import { useDeleteDrive } from "~/hooks/storage/drive";
import { Button, Flex, FlexItem } from "@patternfly/react-core";
import textStyles from "@patternfly/react-styles/css/utilities/Text/text";
import { useDrive } from "~/hooks/storage/model";
import { useDevice } from "~/hooks/model/system/storage";
import type { ConfigModel } from "~/model/storage";
import type { Storage as System } from "~/model/system";

type DriveDeviceMenuToggleProps = CustomToggleProps & {
  drive: ConfigModel.Drive | ConfigModel.MdRaid;
  device: System.Device;
};

const DriveDeviceMenuToggle = forwardRef(
  ({ drive, device, ...props }: DriveDeviceMenuToggleProps, ref) => {
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
            <DriveHeader drive={drive} device={device} {...props} />
          </FlexItem>
          <FlexItem>
            <Icon name="keyboard_arrow_down" style={{ verticalAlign: "middle" }} />
          </FlexItem>
        </Flex>
      </Button>
    );
  },
);

type DriveDeviceMenuProps = {
  drive: ConfigModel.Drive;
  selected: System.Device;
};

/**
 * Internal component that renders generic actions available for a Drive device.
 */
const DriveDeviceMenu = ({ drive, selected }: DriveDeviceMenuProps) => {
  const deleteDrive = useDeleteDrive();
  const deleteFn = (device: ConfigModel.Drive) => deleteDrive(device.name);

  return (
    <SearchedDeviceMenu
      modelDevice={drive}
      selected={selected}
      deleteFn={deleteFn}
      toggle={<DriveDeviceMenuToggle drive={drive} device={selected} />}
    />
  );
};

export type DriveEditorProps = { index: number };

/**
 * Component responsible for displaying detailed information and available actions
 * related to a specific Drive device within the storage ConfigEditor.
 */
export default function DriveEditor({ index }: DriveEditorProps) {
  const driveModel = useDrive(index);
  const drive = useDevice(driveModel.name);

  /**
   * @fixme Make DriveEditor to work when the device is not found (e.g., after disabling
   * a iSCSI device).
   */
  if (drive === undefined) return null;

  return (
    <ConfigEditorItem header={<DriveDeviceMenu drive={driveModel} selected={drive} />}>
      <DeviceEditorContent collection="drives" index={index} />
    </ConfigEditorItem>
  );
}
