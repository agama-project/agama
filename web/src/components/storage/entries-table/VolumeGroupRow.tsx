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
import { NAMES_PER_LINE } from "~/components/storage/shared/naming";
import { baseName, formattedPath } from "~/components/storage/utils";
import { isEmpty } from "radashi";
import configModel from "~/model/storage/config-model";
import { _, n_, formatList, TranslatedString } from "~/i18n";
import type { ConfigModel } from "~/model/storage/config-model";
import type { SheetEntry } from "~/components/storage/shared/use-sheet";

const contentLines = (volumeGroup: ConfigModel.VolumeGroup): TranslatedString[] => {
  const newLogicalVolumes = volumeGroup.logicalVolumes.filter(configModel.volume.isNew);
  const reusedLogicalVolumes = volumeGroup.logicalVolumes.filter(configModel.volume.isReused);
  const lines: TranslatedString[] = [];

  if (isEmpty(newLogicalVolumes) && isEmpty(reusedLogicalVolumes)) {
    lines.push(_("No logical volumes defined"));
  }

  if (!isEmpty(newLogicalVolumes)) {
    const mountPaths = newLogicalVolumes.map((p) => formattedPath(p.mountPath));
    lines.push(
      sprintf(
        // TRANSLATORS: %s is a list of formatted mount points like '"/", "/var" and "swap"' (or a
        // single mount point in the singular case).
        n_("Create a logical volume for %s", "Create logical volumes for %s", mountPaths.length),
        formatList(mountPaths),
      ),
    );
  }

  if (!isEmpty(reusedLogicalVolumes)) {
    const mountPaths = reusedLogicalVolumes.map((p) => formattedPath(p.mountPath));
    lines.push(
      sprintf(
        // TRANSLATORS: %s is a list of formatted mount points like '"/", "/var" and "swap"' (or a
        // single mount point in the singular case).
        n_(
          "Use existing logical volume for %s",
          "Use existing logical volumes for %s",
          mountPaths.length,
        ),
        formatList(mountPaths),
      ),
    );
  }

  return lines;
};

/**
 * TODO: contemplate case of reused
 */
function actionsFor(group: ConfigModel.VolumeGroup): TranslatedString[] {
  const hosts = group.targetDevices || [];
  const lines: TranslatedString[] = [];

  /* One sentence whatever the limit is, with the names punctuated by the
     language rather than by a conjunction of ours. Written with a hole per name
     instead, the sentence and the limit have to agree on a number, and nothing
     makes them: a limit raised past what the sentence has room for drops the
     rest of the names without a mark. */
  // FIXME: We need to contemplate the case of reused VG. Then the sentence should
  // not be here.
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
    // FIXME: A new LVM volume group with no disk chosen? Not really possible in the model
    lines.push(_("Create LVM volume group"));
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
  return (
    <EntryRow
      name={group.vgName}
      purpose={contentLines(group)}
      actions={actionsFor(group)}
      menu={<VolumeGroupMenu group={group} subject={subject} />}
      subject={subject}
    />
  );
}
