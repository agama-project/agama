/*
 * Copyright (c) [2026] SUSE LLC
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
import { Divider } from "@patternfly/react-core";
import { sprintf } from "sprintf-js";
import MenuButton, { MenuButtonItem } from "~/components/core/MenuButton";
import RowMenuToggle from "~/components/core/RowMenuToggle";
import NewVgMenuOption from "~/components/storage/NewVgMenuOption";
import SpacePolicyMenuItem from "~/components/storage/entries-table/SpacePolicyMenuItem";
import ChangeDeviceMenuItem from "~/components/storage/entries-table/ChangeDeviceMenuItem";
import { useDeviceDetails } from "~/components/storage/shared/use-device-details";
import { baseName } from "~/components/storage/utils";
import configModel from "~/model/storage/config-model";
import {
  useConfigModel,
  useDeleteDrive,
  useDeleteMdRaid,
} from "~/hooks/model/storage/config-model";
import { useRetarget } from "~/components/storage/shared/use-retarget";
import { _ } from "~/i18n";
import { useDevice } from "~/hooks/model/system/storage";
import Icon from "~/components/layout/Icon";
import type { Partitionable } from "~/model/storage/config-model";
import type { DetailsSubject } from "~/components/storage/shared/use-device-details";

type RemoveDeviceMenuItemProps = {
  device: Partitionable.Device;
  onClick: (device: Partitionable.Device) => void;
};

const RemoveDeviceMenuItem = ({ device, onClick }: RemoveDeviceMenuItemProps): React.ReactNode => {
  const config = useConfigModel();

  let description: string;
  const isExplicitBoot = configModel.boot.hasExplicitDevice(config, device.name);
  const hasPv = configModel.isTargetDevice(config, device.name);
  const isDisabled = isExplicitBoot || hasPv;

  if (isExplicitBoot) {
    if (hasPv) {
      description = _("The disk is used for LVM and boot");
    } else {
      description = _("The disk is used for booting");
    }
  } else {
    if (hasPv) {
      description = _("The disk is used for LVM");
    } else {
      description = _("Remove the configuration for this disk");
    }
  }

  return (
    <MenuButtonItem
      key="delete"
      icon={<Icon size="md" name="do_not_disturb_on" />}
      isDanger
      isAriaDisabled={isDisabled}
      description={description}
      onClick={isDisabled ? undefined : () => onClick(device)}
    >
      {_("Do not use")}
    </MenuButtonItem>
  );
};

export type DriveMenuProps = {
  /** The disk or RAID in the configuration. */
  entry: Partitionable.Device;
  /** Where it is in the configuration. Without it, the menu offers no way to open its panel. */
  subject?: DetailsSubject;
};

/**
 * The menu of a disk or a software RAID.
 *
 * An action that cannot be carried out is still listed, with the reason as its
 * description, and stays reachable by keyboard.
 */
export default function DriveMenu({ entry, subject }: DriveMenuProps): React.ReactNode {
  const config = useConfigModel();
  const deleteDrive = useDeleteDrive();
  const deleteMdRaid = useDeleteMdRaid();
  const device = useDevice(entry.name);
  const { openDetails } = useDeviceDetails();
  const { title, open, selector } = useRetarget(entry, device);

  const name = baseName(entry.name);
  // TRANSLATORS: %s is a device name, such as "sda"
  const label = sprintf(_("Actions for %s"), name);
  const location = configModel.partitionable.findLocation(config, entry.name);

  const items = subject
    ? [
        <MenuButtonItem
          key="open"
          icon={<Icon size="md" name="article" />}
          /* Screen readers get the full name; on screen, the row says which device. */
          aria-label={sprintf(
            // TRANSLATORS: opens the details panel of a device. %s is its name, such as "sda"
            _("Configure %s"),
            name,
          )}
          description={_("Customize how the disk will be used")}
          onClick={() => openDetails(subject)}
        >
          {/* TRANSLATORS: opens the details panel of a device */}
          {_("Details")}
        </MenuButtonItem>,
      ]
    : [];

  items.push(
    <ChangeDeviceMenuItem
      key="change"
      actionTitle={title}
      device={device}
      modelDevice={entry}
      openFn={open}
    />,
  );

  if (subject) {
    items.push(<SpacePolicyMenuItem key="space-policy" subject={subject} />);
  } else {
    items.push(<NewVgMenuOption key="volume-group" device={entry} />);
  }

  // "Do not use" is offered only when there is another device to install on.
  if (configModel.hasAdditionalDevices(config) && location) {
    items.push(
      <Divider key="before-remove" />,
      <RemoveDeviceMenuItem
        key="remove"
        device={entry}
        onClick={() =>
          location.collection === "drives"
            ? deleteDrive(location.index)
            : deleteMdRaid(location.index)
        }
      />,
    );
  }

  return (
    <>
      <MenuButton
        menuProps={{
          "aria-label": label,
          popperProps: { position: "end", minWidth: "26rem" },
          hasFlyouts: true,
        }}
        customToggle={<RowMenuToggle label={label} />}
        items={items}
      />
      {selector}
    </>
  );
}
