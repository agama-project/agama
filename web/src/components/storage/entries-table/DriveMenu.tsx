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
import DeviceSelectorModal from "~/components/storage/DeviceSelectorModal";
import { whyItCannotMove } from "~/components/storage/shared/retarget";
import { baseName } from "~/components/storage/utils";
import { isDrive, isMd, isVolumeGroup } from "~/model/storage/device";
import configModel from "~/model/storage/config-model";
import {
  useConfigModel,
  useConvertDevice,
  useDeleteDrive,
  useDeleteMdRaid,
} from "~/hooks/model/storage/config-model";
import { useAvailableDevices } from "~/hooks/model/system/storage";
import { _ } from "~/i18n";
import type { Partitionable } from "~/model/storage/config-model";
import type { Storage } from "~/model/system";

export type DriveMenuProps = {
  /** The disk or RAID as the configuration describes it. */
  entry: Partitionable.Device;
  /** The same device as the machine reports it, where the machine has it. */
  device: Storage.Device | null;
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
export default function DriveMenu({ entry, device }: DriveMenuProps): React.ReactNode {
  const config = useConfigModel();
  const available = useAvailableDevices();
  const convertDevice = useConvertDevice();
  const deleteDrive = useDeleteDrive();
  const deleteMdRaid = useDeleteMdRaid();
  const [isSelectorOpen, setIsSelectorOpen] = React.useState(false);

  const name = baseName(entry.name);
  // TRANSLATORS: names the menu of things that can be done to one device of the
  // installation. %s is a device name, such as "sda".
  const label = sprintf(_("Actions for %s"), name);
  const location = configModel.partitionable.findLocation(config, entry.name);

  /* Whether the plan builds anything here, which is not the same question as
     whether this device has entries: a disk given whole to a volume group
     carries an entry per partition being cleared off it and builds nothing. */
  const plansContent =
    Boolean(entry.filesystem) ||
    configModel.partitionable.isAddingPartitions(entry) ||
    configModel.partitionable.isReusingPartitions(entry);

  /* Every device the configuration does not already hold, plus the one it is
     on, which is how the dialog shows what is currently chosen. */
  const taken = configModel
    .devices(config)
    .map((used) => used.name)
    .filter((used) => used !== entry.name);
  const targets = available.filter((candidate) => !taken.includes(candidate.name));

  const cannotMove = whyItCannotMove(config, entry);

  const items = [
    <MenuButtonItem
      key="retarget"
      isAriaDisabled={cannotMove !== null}
      /* Why it cannot be done where it cannot, and otherwise what it costs,
         which the title cannot say: the plan is not being rebuilt, it is being
         moved, and a reader who has spent time on this device's content needs
         to know it comes along. Said only where there is content to carry. */
      description={
        cannotMove ||
        (plansContent
          ? sprintf(
              // TRANSLATORS: what happens to the plan when the reader picks a
              // different device for it. %s is a device name, such as "sda".
              _("Everything planned for %s moves to the device you pick."),
              name,
            )
          : undefined)
      }
      onClick={cannotMove ? undefined : () => setIsSelectorOpen(true)}
    >
      {/* TRANSLATORS: offered on a device of the installation: put everything
          planned for it somewhere else instead. */}
      {_("Use another device")}
    </MenuButtonItem>,
    <Divider key="before-vg" />,
    <NewVgMenuOption key="volume-group" device={entry} />,
  ];

  if (configModel.hasAdditionalDevices(config) && location) {
    items.push(
      <Divider key="before-remove" />,
      <MenuButtonItem
        key="remove"
        isDanger
        onClick={() =>
          location.collection === "drives"
            ? deleteDrive(location.index)
            : deleteMdRaid(location.index)
        }
      >
        {/* TRANSLATORS: offered on a device of the installation: take it out of
            the plan altogether. */}
        {_("Do not use this device")}
      </MenuButtonItem>,
    );
  }

  return (
    <>
      <MenuButton
        menuProps={{ "aria-label": label, popperProps: { position: "end" } }}
        customToggle={<RowMenuToggle label={label} />}
        items={items}
      />
      {isSelectorOpen && (
        <DeviceSelectorModal
          title={_("Use another device")}
          intro={
            plansContent
              ? sprintf(
                  // TRANSLATORS: said above the list of devices to move the plan
                  // to. %s is a device name, such as "sda".
                  _("The plan stays as it is. Everything %s was going to hold moves."),
                  name,
                )
              : // TRANSLATORS: said above the list of devices to move the plan to,
                // where the installer builds nothing on the current one.
                _("The plan stays as it is.")
          }
          selected={device}
          disks={targets.filter(isDrive)}
          mdRaids={targets.filter(isMd)}
          volumeGroups={targets.filter(isVolumeGroup)}
          onCancel={() => setIsSelectorOpen(false)}
          onConfirm={([target]: Storage.Device[]) => {
            setIsSelectorOpen(false);
            convertDevice(entry.name, target.name);
          }}
        />
      )}
    </>
  );
}
