/*
 * Copyright (c) [2025-2026] SUSE LLC
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

import React, { useState } from "react";
import { useNavigate } from "react-router";
import MenuButton, { MenuButtonItem } from "~/components/core/MenuButton";
import { Divider, Flex, MenuItemProps } from "@patternfly/react-core";
import { useAvailableDevices } from "~/hooks/model/system/storage";
import {
  useConfigModel,
  useAddDrive,
  useAddMdRaid,
  useAddVolumeGroup,
} from "~/hooks/model/storage/config-model";
import { STORAGE as PATHS } from "~/routes/paths";
import { sprintf } from "sprintf-js";
import { _, n_ } from "~/i18n";
import DeviceSelectorModal from "./DeviceSelectorModal";
import { isDrive, isMd, isVolumeGroup } from "~/model/storage/device";
import configModel from "~/model/storage/config-model";
import { Icon } from "../layout";
import type { Storage } from "~/model/system";

type AddDeviceMenuItemProps = {
  /** Whether some of the available devices is an MD RAID */
  withRaids: boolean;
  /** Whether some of the available devices is an LVM volume group */
  withLvm: boolean;
  /** Available devices to be chosen */
  devices: Storage.Device[];
  /** The total amount of devices (drives, RAIDs and VGs) already configured */
  usedCount: number;
} & MenuItemProps;

const AddDeviceTitle = ({ withRaids, withLvm, usedCount }) => {
  if (withRaids || withLvm) {
    if (usedCount === 0) return _("Select an existing device");
    return _("Select another existing device");
  }

  if (usedCount === 0) return _("Select a disk");
  return _("Select another disk");
};

const AddDeviceDescription = ({ withRaids, withLvm, usedCount, isDisabled = false }) => {
  if (isDisabled) {
    if (withRaids || withLvm) return _("Already using all available devices");
    return _("Already using all available disks");
  }

  if (usedCount) {
    if (withRaids || withLvm)
      return sprintf(
        n_(
          "Extend the installation beyond the currently selected device",
          "Extend the installation beyond the current %d devices",
          usedCount,
        ),
        usedCount,
      );

    return sprintf(
      n_(
        "Extend the installation beyond the currently selected disk",
        "Extend the installation beyond the current %d disks",
        usedCount,
      ),
      usedCount,
    );
  }

  return _("Start configuring a basic installation");
};

/**
 * Internal component holding the logic for rendering the disks drilldown menu
 */
const AddDeviceMenuItem = ({
  withRaids,
  withLvm,
  usedCount,
  devices,
  onClick,
}: AddDeviceMenuItemProps): React.ReactNode => {
  const isDisabled = !devices.length;
  return (
    <>
      <MenuButtonItem
        aria-label={_("Add device menu")}
        isDisabled={isDisabled}
        description={
          <AddDeviceDescription
            withRaids={withRaids}
            withLvm={withLvm}
            usedCount={usedCount}
            isDisabled={isDisabled}
          />
        }
        onClick={onClick}
      >
        <AddDeviceTitle withRaids={withRaids} withLvm={withLvm} usedCount={usedCount} />
      </MenuButtonItem>
    </>
  );
};

/**
 * Menu that provides options for users to configure storage drives
 *
 */
export default function ConfigureDeviceMenu(): React.ReactNode {
  const [deviceSelectorOpen, setDeviceSelectorOpen] = useState(false);
  const openDeviceSelector = () => setDeviceSelectorOpen(true);
  const closeDeviceSelector = () => setDeviceSelectorOpen(false);

  const navigate = useNavigate();

  const config = useConfigModel();
  const addDrive = useAddDrive();
  const addMdRaid = useAddMdRaid();
  const addVolumeGroup = useAddVolumeGroup();
  const allDevices = useAvailableDevices();

  const usedDevicesNames = configModel.devices(config).map((d) => d.name);
  const usedDevicesCount = usedDevicesNames.length;
  const availableDevices = allDevices.filter((d) => !usedDevicesNames.includes(d.name));
  const disks = availableDevices.filter(isDrive);
  const mdRaids = availableDevices.filter(isMd);
  const volumeGroups = availableDevices.filter(isVolumeGroup);
  const withRaids = !!allDevices.filter((d) => isMd(d)).length;
  const withLvm = !!allDevices.filter((d) => isVolumeGroup(d)).length;

  const addDevice = (device: Storage.Device) => {
    if (isDrive(device)) addDrive({ name: device.name, spacePolicy: "keep" });

    if (isMd(device)) addMdRaid({ name: device.name, spacePolicy: "keep" });

    if (isVolumeGroup(device)) addVolumeGroup({ name: device.name, spacePolicy: "keep" }, false);
  };

  const lvmDescription = allDevices.length
    ? _("Define a new LVM on top of one or several disks")
    : _("Define a new LVM on the disk");

  return (
    <>
      <MenuButton
        menuProps={{
          "aria-label": _("Configure device menu"),
          popperProps: {
            position: "left",
          },
        }}
        toggleProps={{ variant: "plain" }}
        items={[
          <AddDeviceMenuItem
            key="select-disk-option"
            usedCount={usedDevicesCount}
            devices={availableDevices}
            withRaids={withRaids}
            withLvm={withLvm}
            onClick={openDeviceSelector}
          />,
          <Divider key="divider-option" />,
          <MenuButtonItem
            key="add-lvm-option"
            onClick={() => navigate(PATHS.volumeGroup.add)}
            description={lvmDescription}
          >
            {_("Add LVM volume group")}
          </MenuButtonItem>,
        ]}
      >
        <Flex alignItems={{ default: "alignItemsCenter" }} gap={{ default: "gapSm" }}>
          <Icon name="add_circle" /> {_("More devices")}
        </Flex>
      </MenuButton>
      {deviceSelectorOpen && (
        <DeviceSelectorModal
          disks={disks}
          mdRaids={mdRaids}
          volumeGroups={volumeGroups}
          title={
            <AddDeviceTitle withRaids={withRaids} withLvm={withLvm} usedCount={usedDevicesCount} />
          }
          intro={
            <AddDeviceDescription
              withRaids={withRaids}
              withLvm={withLvm}
              usedCount={usedDevicesCount}
            />
          }
          tabIntros={{
            disks: _("Choose a disk to define partitions or to mount"),
            mdRaids: _("Choose a RAID device to define partitions or to mount"),
            volumeGroups: _("Choose a volume group to define logical volumes"),
          }}
          onCancel={closeDeviceSelector}
          onConfirm={([device]) => {
            addDevice(device);
            closeDeviceSelector();
          }}
        />
      )}
    </>
  );
}
