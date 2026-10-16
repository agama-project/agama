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
import RowMenuToggle from "~/components/storage/entries-table/RowMenuToggle";
import NewVgMenuOption from "~/components/storage/NewVgMenuOption";
import { useSheet } from "~/components/storage/shared/use-sheet";
import { baseName } from "~/components/storage/utils";
import configModel from "~/model/storage/config-model";
import {
  useConfigModel,
  useDeleteDrive,
  useDeleteMdRaid,
} from "~/hooks/model/storage/config-model";
import { _ } from "~/i18n";
import type { Partitionable } from "~/model/storage/config-model";
import type { SheetEntry } from "~/components/storage/shared/use-sheet";

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
      isDanger
      isDisabled={isDisabled}
      description={description}
      onClick={() => onClick(device)}
    >
      {_("Do not use")}
    </MenuButtonItem>
  );
};

export type DriveMenuProps = {
  /** The disk or RAID as the configuration describes it. */
  entry: Partitionable.Device;
  /** Where it is written. Given only where opening it is one of the offers. */
  subject?: SheetEntry;
};

/**
 * What can be done to a disk or a software RAID, from its row.
 *
 * Everything the row offers is named the way the rest of the page names it, so
 * a reader meets one name per act wherever they meet it. An act keeps its name
 * even where it cannot be carried out: an offer renamed into its own refusal is
 * an offer a reader looking for it cannot find.
 *
 * Dropping the only device leaves the installation nowhere to go, so that is
 * offered only where there is somewhere else for it to live.
 *
 * An act that cannot be carried out is still offered and still called what it
 * is called, with the reason where its description goes. It stays reachable by
 * keyboard: a control the browser disables is skipped, and the explanation
 * printed beside it is then never met by the reader it was written for.
 */
export default function DriveMenu({ entry, subject }: DriveMenuProps): React.ReactNode {
  const config = useConfigModel();
  const deleteDrive = useDeleteDrive();
  const deleteMdRaid = useDeleteMdRaid();
  const { openSheet } = useSheet();

  const name = baseName(entry.name);
  // TRANSLATORS: names the menu of things that can be done to one device of the
  // installation. %s is a device name, such as "sda".
  const label = sprintf(_("Actions for %s"), name);
  const location = configModel.partitionable.findLocation(config, entry.name);

  const items = [
    /* First, because it is what clicking the row does. A menu whose first item
       is the row's own act says what the row does, for a reader who never
       discovers that rows can be opened and for one who cannot click.

       Left out in the sheet's own header, where the reader is already inside
       what it would open. */
    ...(subject
      ? [
          <MenuButtonItem
            key="open"
            /* Named in full only for a reader who is told the item rather than
               shown it. On screen the menu hangs off the row it belongs to, and
               a name the reader can see beside the item is a name repeated. */
            aria-label={sprintf(
              // TRANSLATORS: opens the panel where one entry of the installation
              // is read and changed. %s is its name, such as "sda".
              _("Configure %s"),
              name,
            )}
            description={_("Configure how the disk will be used")}
            onClick={() => openSheet(subject)}
          >
            {/* TRANSLATORS: opens the panel where one entry of the installation
                is read and changed. */}
            {_("Details")}
          </MenuButtonItem>,
        ]
      : []),
    <NewVgMenuOption key="volume-group" device={entry} />,
  ];

  // When no additional drives has been added, the "Do not use" button can be confusing so it is
  // omitted for all drives.
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
    <MenuButton
      menuProps={{ "aria-label": label, popperProps: { position: "end" } }}
      customToggle={<RowMenuToggle label={label} />}
      items={items}
    />
  );
}
