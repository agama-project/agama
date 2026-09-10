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
import { sprintf } from "sprintf-js";
import EntryRow from "~/components/storage/entries-table/EntryRow";
import DriveMenu from "~/components/storage/entries-table/DriveMenu";
import { consequencesOf } from "~/components/storage/shared/consequences";
import { NAMES_PER_LINE } from "~/components/storage/shared/naming";
import { useDevicesManager } from "~/components/storage/shared/use-devices-manager";
import { baseName, deviceSize } from "~/components/storage/utils";
import { typeDescription } from "~/components/storage/utils/device";
import { useConfigModel } from "~/hooks/model/storage/config-model";
import { useDevice } from "~/hooks/model/system/storage";
import configModel from "~/model/storage/config-model";
import { _, n_, TranslatedString } from "~/i18n";
import type { Partitionable } from "~/model/storage/config-model";
import type { SheetEntry } from "~/components/storage/shared/use-sheet";

/**
 * What the installer will do here, as counts and never as names.
 *
 * The list is read by comparing many devices at a glance, and a row spelling
 * out six mount paths is taller than the entry it points at. The names are in
 * the device's own panel, one click away.
 *
 * Every line names something the installer does, so the ones about what a disk
 * carries take a verb like the rest rather than sitting there as a bare count.
 * Booting joins the hosting line rather than taking one of its own: a disk that
 * carries a volume group and starts the machine is doing two jobs, and the
 * reader takes them in as one answer to "what is this disk for".
 */
function purposeOf(
  device: Partitionable.Device,
  groups: string[],
  boots: boolean,
): TranslatedString[] {
  const lines: TranslatedString[] = [];
  const partitions = device.partitions || [];
  /* A partition asked for by id and nothing else, a BIOS boot or a PReP
     partition, is planned content too: it takes room and was asked for. */
  const created = partitions.filter(
    (partition) => configModel.volume.isNew(partition) && (partition.mountPath || partition.id),
  ).length;
  const reused = partitions.filter(configModel.volume.isReused).length;

  if (device.filesystem) {
    lines.push(
      device.mountPath
        ? sprintf(
            // TRANSLATORS: what the installer will do with a whole disk. %s is
            // where the new system will mount it, such as "/home".
            _("Format for %s"),
            device.mountPath,
          )
        : // TRANSLATORS: what the installer will do with a whole disk that the
          // new system does not mount anywhere.
          _("Format as a whole"),
    );
  }

  if (created) {
    // TRANSLATORS: what the installer will do here. %d is how many partitions
    // it will create.
    lines.push(sprintf(n_("Create %d partition", "Create %d partitions", created), created));
  }

  if (reused) {
    // TRANSLATORS: what the installer will do here. %d is how many partitions
    // already on the disk the new system will take over as they are.
    lines.push(sprintf(n_("Reuse %d partition", "Reuse %d partitions", reused), reused));
  }

  /* Named rather than counted while there is room, which is the other end of
     what a group's own row says. A reader arriving at the disk used to learn
     that something LVM was there and had to go looking for what. */
  if (groups.length === 1) {
    lines.push(
      sprintf(
        boots
          ? // TRANSLATORS: what a disk is for: it holds an LVM volume group and
            // the machine starts from it. %s is the group's name, such as
            // "system".
            _("Host LVM volume group %s and boot")
          : // TRANSLATORS: what a disk is for: it holds an LVM volume group.
            // %s is the group's name, such as "system".
            _("Host LVM volume group %s"),
        groups[0],
      ),
    );
  } else if (groups.length > 1 && groups.length <= NAMES_PER_LINE) {
    lines.push(
      sprintf(
        boots
          ? // TRANSLATORS: what a disk is for: it holds two LVM volume groups
            // and the machine starts from it. %1$s and %2$s are their names.
            _("Host LVM volume groups %1$s and %2$s and boot")
          : // TRANSLATORS: what a disk is for: it holds two LVM volume groups.
            // %1$s and %2$s are their names.
            _("Host LVM volume groups %1$s and %2$s"),
        groups[0],
        groups[1],
      ),
    );
  } else if (groups.length > NAMES_PER_LINE) {
    lines.push(
      sprintf(
        boots
          ? // TRANSLATORS: what a disk is for. %d is how many LVM volume groups
            // it holds, and the machine also starts from it.
            n_(
              "Host %d LVM volume group and boot",
              "Host %d LVM volume groups and boot",
              groups.length,
            )
          : // TRANSLATORS: what a disk is for. %d is how many LVM volume groups
            // it holds.
            n_("Host %d LVM volume group", "Host %d LVM volume groups", groups.length),
        groups.length,
      ),
    );
  }

  /* Nothing else to hang it on, so it is a line of its own. */
  if (boots && !groups.length) {
    // TRANSLATORS: what a disk is for: the machine starts from it.
    lines.push(_("Start the new system"));
  }

  return lines;
}

export type DriveRowProps = {
  /** The device the configuration names, as the model spells it. */
  name: string;
  /** Where it is written, which is how the sheet is opened on it. */
  subject: SheetEntry;
};

/**
 * A disk or a software RAID, as a row of the list.
 *
 * Split from the volume group's row rather than switched inside one component.
 * Both read the machine, and a single row deciding what it is looking at would
 * call a different number of hooks depending on the answer.
 *
 * How big it is, what kind of thing it is and how it is partitioned are read in
 * one phrase beside the name. A configuration can name a device the machine
 * does not have, a profile written elsewhere or a disk since unplugged, so
 * every part of that phrase is left out where there is nothing to say.
 */
export default function DriveRow({ name, subject }: DriveRowProps): React.ReactNode {
  const config = useConfigModel();
  const device = useDevice(name);
  const manager = useDevicesManager();

  const entry = configModel.partitionable.findByName(config, name);
  const description = [
    device?.block?.size && deviceSize(device.block.size),
    device && typeDescription(device),
    device?.partitionTable?.type?.toUpperCase(),
  ]
    .filter(Boolean)
    .join("  ·  ");

  const groups = entry ? configModel.partitionable.filterVolumeGroups(config, entry) : [];
  const boots = configModel.boot.hasDevice(config, name);
  const purpose = entry
    ? purposeOf(
        entry,
        groups.map((group) => group.vgName),
        boots,
      )
    : ([] as TranslatedString[]);

  return (
    <EntryRow
      name={baseName(name)}
      description={description}
      // TRANSLATORS: marks the device the machine will start from.
      marks={boots ? [_("Boot device")] : []}
      purpose={purpose}
      consequences={consequencesOf(manager, device?.partitions || [])}
      menu={entry && <DriveMenu entry={entry} device={device} subject={subject} />}
      subject={subject}
    />
  );
}
