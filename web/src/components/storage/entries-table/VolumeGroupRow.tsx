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
import VolumeGroupMenu from "~/components/storage/entries-table/VolumeGroupMenu";
import { consequencesOf } from "~/components/storage/shared/consequences";
import { useDevicesManager } from "~/components/storage/shared/use-devices-manager";
import { NAMES_PER_LINE } from "~/components/storage/shared/naming";
import { baseName } from "~/components/storage/utils";
import { useDevice } from "~/hooks/model/system/storage";
import { _, n_, formatList, TranslatedString } from "~/i18n";
import type { ConfigModel } from "~/model/storage/config-model";
import type { SheetEntry } from "~/components/storage/shared/use-sheet";

/**
 * What a volume group is, from both ends.
 *
 * Where it sits comes first, which is what its row used to lack: a group named
 * without its disks is a row about something floating, and a reader scanning
 * two rows should learn the group lives on the disk from whichever they meet
 * first.
 *
 * What it will hold is a count rather than a list. Six logical volumes named
 * after long mount paths turn a row into four lines of text, which is what the
 * group's own panel is for.
 */
function purposeOf(group: ConfigModel.VolumeGroup): TranslatedString[] {
  const hosts = group.targetDevices || [];
  const volumes = (group.logicalVolumes || []).length;
  const lines: TranslatedString[] = [];

  /* One sentence whatever the limit is, with the names punctuated by the
     language rather than by a conjunction of ours. Written with a hole per name
     instead, the sentence and the limit have to agree on a number, and nothing
     makes them: a limit raised past what the sentence has room for drops the
     rest of the names without a mark. */
  if (hosts.length && hosts.length <= NAMES_PER_LINE) {
    lines.push(
      sprintf(
        // TRANSLATORS: where an LVM volume group will be created. %s is one or
        // more disk names, such as "sda" or "sda and sdb".
        _("Create LVM volume group on %s"),
        formatList(hosts.map((host) => baseName(host))),
      ),
    );
  } else if (hosts.length > NAMES_PER_LINE) {
    lines.push(
      sprintf(
        // TRANSLATORS: where an LVM volume group will be created. %d is how
        // many disks it is spread over.
        n_(
          "Create LVM volume group on %d disk",
          "Create LVM volume group on %d disks",
          hosts.length,
        ),
        hosts.length,
      ),
    );
  } else {
    // TRANSLATORS: said of an LVM volume group with no disk chosen for it yet.
    lines.push(_("Create LVM volume group"));
  }

  if (volumes) {
    lines.push(
      sprintf(
        // TRANSLATORS: what an LVM volume group will hold. %d is how many
        // logical volumes the new system gets from it.
        n_("Define %d logical volume", "Define %d logical volumes", volumes),
        volumes,
      ),
    );
  }

  return lines;
}

export type VolumeGroupRowProps = {
  /** The group as the configuration describes it. */
  group: ConfigModel.VolumeGroup;
  /** Where it is written, which is how the sheet is opened on it. */
  subject: SheetEntry;
};

/**
 * An LVM volume group, as a row of the list.
 *
 * Nothing beside the name. A group is defined rather than found, so there is no
 * hardware to describe: how big it is follows from the disks under it, and the
 * category it is listed under already says what kind of thing it is.
 *
 * A group being defined for the first time costs nothing, since there is
 * nothing of it on the machine yet. One that already exists is read like any
 * other entry: what the installer does to what it holds.
 */
export default function VolumeGroupRow({ group, subject }: VolumeGroupRowProps): React.ReactNode {
  const device = useDevice(group.name || "");
  const manager = useDevicesManager();

  return (
    <EntryRow
      name={group.vgName}
      purpose={purposeOf(group)}
      consequences={consequencesOf(manager, device?.logicalVolumes || [])}
      menu={<VolumeGroupMenu group={group} subject={subject} />}
      subject={subject}
    />
  );
}
