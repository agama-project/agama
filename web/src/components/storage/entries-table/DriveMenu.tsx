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
import { useLocation, useNavigate } from "react-router";
import { sprintf } from "sprintf-js";
import MenuButton, { MenuButtonItem } from "~/components/core/MenuButton";
import RowMenuToggle from "~/components/storage/entries-table/RowMenuToggle";
import NewVgMenuOption from "~/components/storage/NewVgMenuOption";
import ChangeInstallationDisk from "~/components/storage/storage-page/ChangeInstallationDisk";
import { useDeviceDetails } from "~/components/storage/shared/use-device-details";
import { useRetarget } from "~/components/storage/shared/use-retarget";
import {
  hasSpaceDecision,
  SpacePolicyMenuItem,
} from "~/components/storage/device-details/SpaceDecision";
import { STORAGE as PATHS } from "~/routes/paths";
import { generateEncodedPath } from "~/utils";
import { baseName } from "~/components/storage/utils";
import configModel from "~/model/storage/config-model";
import {
  useConfigModel,
  useDeleteDrive,
  useDeleteMdRaid,
  useSetFilesystem,
} from "~/hooks/model/storage/config-model";
import { useCandidateDrives } from "~/hooks/model/system/storage";
import { _ } from "~/i18n";
import type { Partitionable } from "~/model/storage/config-model";
import type { DetailsSubject } from "~/components/storage/shared/use-device-details";
import type { Storage } from "~/model/system";

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
  subject?: DetailsSubject;
  /** The same device as the machine reports it, where the machine has it. */
  device?: Storage.Device | null;
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
export default function DriveMenu({
  entry,
  subject,
  device = null,
}: DriveMenuProps): React.ReactNode {
  const navigate = useNavigate();
  const { search } = useLocation();
  const retarget = useRetarget(entry, device);
  const setFilesystem = useSetFilesystem();
  const config = useConfigModel();
  const deleteDrive = useDeleteDrive();
  const deleteMdRaid = useDeleteMdRaid();
  const { openDetails } = useDeviceDetails();
  const candidate = useCandidateDrives();
  const [isChangingDisk, setIsChangingDisk] = React.useState(false);

  const name = baseName(entry.name);
  // TRANSLATORS: names the menu of things that can be done to one device of the
  // installation. %s is a device name, such as "sda".
  const label = sprintf(_("Actions for %s"), name);
  const location = configModel.partitionable.findLocation(config, entry.name);

  const isMounted = !!entry.mountPath;
  const isUsed = configModel.partitionable.isUsed(config, entry.name);

  /* The same acts the panel offers, in the same cases: a device given whole
     to one file system, one with partitions planned, or one with nothing
     planned yet. */
  const panelActs = (at: DetailsSubject) => {
    const params = { collection: at.collection, index: String(at.index) };
    const go = (path: string) => navigate({ pathname: generateEncodedPath(path, params), search });

    const addPartition = (
      <MenuButtonItem
        key="add-partition"
        description={_("Define a new partition on the device")}
        onClick={() => go(PATHS.addPartition)}
      >
        {/* TRANSLATORS: menu item on a disk or RAID of the installation:
            opens the form to add a partition to it. */}
        {_("Add partition")}
      </MenuButtonItem>
    );

    if (isMounted) {
      return [
        <MenuButtonItem
          key="edit-filesystem"
          description={_("Change how the file system on the whole device is used")}
          onClick={() => go(PATHS.formatDevice)}
        >
          {/* TRANSLATORS: menu item on a disk or RAID used whole for one file
              system: change how it is used. */}
          {_("Edit file system")}
        </MenuButtonItem>,
        <MenuButtonItem
          key="stop-filesystem"
          description={_("Leave nothing planned on the device")}
          onClick={() => {
            if (configModel.partitionable.isCollectionName(at.collection))
              setFilesystem(at.collection, at.index, {});
          }}
        >
          {/* TRANSLATORS: menu item on a disk or RAID used whole for one file
              system: stop using it for that file system. */}
          {_("Stop using as file system")}
        </MenuButtonItem>,
      ];
    }

    if (isUsed) return [addPartition];

    return [
      addPartition,
      <MenuButtonItem
        key="format"
        description={_("Give the whole device to one file system, with no partitions")}
        onClick={() => go(PATHS.formatDevice)}
      >
        {/* TRANSLATORS: menu item on a disk or RAID nothing is planned on
            yet: use the whole device for one file system. */}
        {_("Format device")}
      </MenuButtonItem>,
    ];
  };

  /* Moving what is planned elsewhere acts on the device as a whole, so it sits
     with the other such acts rather than with what goes on it. */
  const move = isUsed && !isMounted && (
    <MenuButtonItem
      key="move"
      description={_("Move what is planned for this device to another one")}
      onClick={() => retarget.open()}
    >
      {/* TRANSLATORS: menu item on a disk or RAID of the installation: moves
          everything planned for it to a different device. */}
      {_("Move to another device")}
    </MenuButtonItem>
  );

  const items = [
    /* First, because it is what clicking the row does. A menu whose first item
       is the row's own act says what the row does, for a reader who never
       discovers that rows can be opened and for one who cannot click.

       Left out in the panel's own header, where the reader is already inside
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
            onClick={() => openDetails(subject)}
          >
            {/* TRANSLATORS: opens the panel where one entry of the installation
                is read and changed. */}
            {_("Details")}
          </MenuButtonItem>,
          <Divider key="before-content" />,
        ]
      : []),
    /* What may happen to what the device holds today, as the panel's own
       choice; only on the row, and only where there is something to decide. */
    ...(subject &&
    configModel.partitionable.isCollectionName(subject.collection) &&
    hasSpaceDecision(device?.partitions, entry.partitions)
      ? [
          <SpacePolicyMenuItem
            key="space-policy"
            collection={subject.collection}
            index={subject.index}
            policy={entry.spacePolicy || "keep"}
            someReused={(entry.partitions || []).some((p) => p.name && p.mountPath)}
          />,
        ]
      : []),
    /* The panel's own acts, also from the row, for a reader who wants them
       without opening the panel. Left out of the panel's header, where they
       sit under its sections. */
    ...(subject ? panelActs(subject) : []),
    <Divider key="after-content" />,
    ...(subject ? [move] : []),
    <NewVgMenuOption key="volume-group" device={entry} />,
  ];

  const canChangeTarget =
    location?.collection === "drives" &&
    configModel.canChangeTargetDrive(config) &&
    candidate.length > 1;

  if (canChangeTarget) {
    items.push(
      <MenuButtonItem
        key="change-disk"
        // TRANSLATORS: description of the menu item that puts the whole
        // installation on a different disk.
        description={_("Install the system on a different disk")}
        onClick={() => setIsChangingDisk(true)}
      >
        {/* TRANSLATORS: menu item that opens a choice of another disk to
            install the system on. */}
        {_("Change target disk…")}
      </MenuButtonItem>,
    );
  }

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
    <>
      <MenuButton
        menuProps={{
          "aria-label": label,
          popperProps: { position: "end", minWidth: "24rem" },
          hasFlyouts: true,
        }}
        customToggle={<RowMenuToggle label={label} />}
        items={items}
      />
      {isChangingDisk && <ChangeInstallationDisk onClose={() => setIsChangingDisk(false)} />}
      {retarget.selector}
    </>
  );
}
