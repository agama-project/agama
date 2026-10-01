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
import * as driveUtils from "~/components/storage/utils/drive";
import { NAMES_PER_LINE } from "~/components/storage/shared/naming";
import { deviceSize, formattedPath } from "~/components/storage/utils";
import { typeDescription } from "~/components/storage/utils/device";
import { useConfigModel } from "~/hooks/model/storage/config-model";
import { useDevice } from "~/hooks/model/system/storage";
import TruncatedDeviceName from "~/components/storage/TruncatedDeviceName";
import DeviceContent from "~/components/storage/DeviceContent";
import configModel from "~/model/storage/config-model";
import { _, n_, formatList, TranslatedString } from "~/i18n";
import type { ConfigModel, Partitionable } from "~/model/storage/config-model";
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
  const lines: TranslatedString[] = driveUtils.contentDescription(device);

  /* Named rather than counted while there is room, which is the other end of
     what a group's own row says. A reader arriving at the disk used to learn
     that something LVM was there and had to go looking for what.

     One sentence whatever the limit is, with the names punctuated by the
     language rather than by a conjunction of ours. Written with a hole per name
     instead, the sentence and the limit have to agree on a number, and nothing
     makes them: a limit raised past what the sentence has room for drops the
     rest of the names without a mark. */
  if (groups.length && groups.length <= NAMES_PER_LINE) {
    lines.unshift(
      sprintf(
        // TRANSLATORS: what a disk is for: it holds one or more LVM volume
        // groups. %s is their names, such as "system" or "system and data".
        _("Create LVM physical volumes for %s"),
        formatList(groups.map((g) => formattedPath(g))),
      ),
    );
  } else if (groups.length > NAMES_PER_LINE) {
    lines.unshift(
      sprintf(
        n_(
          "Create LVM physical volumes for %d volume group",
          "Create LVM physical volumes for %d volume groups",
          groups.length,
        ),
        groups.length,
      ),
    );
  }

  /* Nothing else to hang it on, so it is a line of its own. */
  if (boots) {
    // TRANSLATORS: what a disk is for: the machine starts from it.
    lines.push(_("Configure partitions to boot"));
  }

  return lines;
}

export type DriveRowProps = {
  /** The device the configuration names, as the model spells it. */
  name: string;
  /** Where it is written, which is how the sheet is opened on it. */
  subject: SheetEntry;
};

const driveDescription = (device) => {
  const model = device.drive?.model;
  if (model && model.length) return model;

  return typeDescription(device);
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

  const entry = configModel.partitionable.findByName(config, name);
  const description = [];
  description.push(
    [device?.block?.size && deviceSize(device.block.size), device && driveDescription(device)]
      .filter(Boolean)
      .join("  ·  "),
  );
  description.push(<DeviceContent device={device} />);

  const groups = entry ? configModel.partitionable.filterVolumeGroups(config, entry) : [];
  const boots = configModel.boot.hasDevice(config, name);
  const purpose = entry
    ? purposeOf(
        entry,
        groups.map((group) => group.vgName),
        boots,
      )
    : ([] as TranslatedString[]);

  const space = driveUtils.contentActionsSummary(entry as ConfigModel.Drive);

  return (
    <EntryRow
      name={<TruncatedDeviceName device={device} maxLength={13} />}
      description={description}
      purpose={purpose}
      actions={space}
      menu={entry && <DriveMenu entry={entry} device={device} subject={subject} />}
      subject={subject}
    />
  );
}
