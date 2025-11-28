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

import React, { useState } from "react";
import { useNavigate } from "react-router";
import MenuButton, { MenuButtonItem } from "~/components/core/MenuButton";
import { Divider, Flex, MenuItemProps } from "@patternfly/react-core";
import { useAvailableDevices } from "~/hooks/api/system/storage";
import { useModel } from "~/hooks/storage/model";
import { useAddDrive } from "~/hooks/storage/drive";
import { useAddReusedMdRaid } from "~/hooks/storage/md-raid";
import { STORAGE as PATHS } from "~/routes/paths";
import { sprintf } from "sprintf-js";
import { _, n_ } from "~/i18n";
import DeviceSelectorModal from "./DeviceSelectorModal";
import { isDrive } from "~/storage/device";
import { Icon } from "../layout";
import type { storage } from "~/model/system";

type AddDeviceMenuItemProps = {
  /** Whether some of the available devices is an MD RAID */
  withRaids: boolean;
  /** Available devices to be chosen */
  devices: storage.Device[];
  /** The total amount of drives and RAIDs already configured */
  usedCount: number;
} & MenuItemProps;

const AddDeviceTitle = ({ withRaids, usedCount }) => {
  if (withRaids) {
    if (usedCount === 0) return _("Select a device to define partitions or to mount");
    return _("Select another device to define partitions or to mount");
  }

  if (usedCount === 0) return _("Select a disk to define partitions or to mount");
  return _("Select another disk to define partitions or to mount");
};

const AddDeviceDescription = ({ withRaids, usedCount, isDisabled = false }) => {
  if (isDisabled) {
    if (withRaids) return _("Already using all available devices");
    return _("Already using all available disks");
  }

  if (usedCount) {
    if (withRaids)
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
            usedCount={usedCount}
            isDisabled={isDisabled}
          />
        }
        onClick={onClick}
      >
        <AddDeviceTitle withRaids={withRaids} usedCount={usedCount} />
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

  const model = useModel();
  const addDrive = useAddDrive();
  const addReusedMdRaid = useAddReusedMdRaid();
  const allDevices = useAvailableDevices();

  const usedDevicesNames = model.drives.concat(model.mdRaids).map((d) => d.name);
  const usedDevicesCount = usedDevicesNames.length;
  const devices = allDevices.filter((d) => !usedDevicesNames.includes(d.name));
  const withRaids = !!allDevices.filter((d) => !isDrive(d)).length;

  const addDevice = (device: storage.Device) => {
    const hook = isDrive(device) ? addDrive : addReusedMdRaid;
    hook({ name: device.name, spacePolicy: "keep" });
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
            devices={devices}
            withRaids={withRaids}
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
          {/** TODO: choose one, "add" or "add_circle", and remove the other at Icon.tsx */}
          <Icon name="add_circle" /> {_("More devices")}
        </Flex>
      </MenuButton>
      {deviceSelectorOpen && (
        <DeviceSelectorModal
          devices={devices}
          title={<AddDeviceTitle withRaids={withRaids} usedCount={usedDevicesCount} />}
          description={<AddDeviceDescription withRaids={withRaids} usedCount={usedDevicesCount} />}
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
