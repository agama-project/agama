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
import EntryRow from "~/components/storage/entries-table/EntryRow";
import VolumeGroupMenu from "~/components/storage/entries-table/VolumeGroupMenu";
import TruncatedDeviceName from "~/components/storage/TruncatedDeviceName";
import { volumeGroupUsedFor, ExistingDataCell } from "~/components/storage/entries-table/cells";
import { volumeGroupFacts } from "~/components/storage/utils/device";
import { useDevice } from "~/hooks/model/system/storage";
import configModel from "~/model/storage/config-model";
import { _ } from "~/i18n";
import type { ConfigModel } from "~/model/storage/config-model";
import type { DetailsSubject } from "~/components/storage/shared/use-device-details";

export type VolumeGroupRowProps = {
  /** The group as the configuration describes it. */
  group: ConfigModel.VolumeGroup;
  /** Where it is written, which is how the panel is opened on it. */
  subject: DetailsSubject;
  /**
   * Whether the row sits under a title naming its kind, so the line under its
   * name only needs to say whether the group is new.
   */
  isGrouped?: boolean;
};

/**
 * An LVM volume group, as a row of the list.
 *
 * Its first column reads like a disk's: the size beside the name, where the
 * machine has the group, and a short line under it, its kind or that it is to
 * be created (see {@link volumeGroupFacts}).
 *
 * A group being defined for the first time costs nothing, since there is
 * nothing of it on the machine yet. One that already exists is read like any
 * other entry: what the installer does to what it holds.
 */
export default function VolumeGroupRow({
  group,
  subject,
  isGrouped = false,
}: VolumeGroupRowProps): React.ReactNode {
  const device = useDevice(group.name || "");
  const { size, description } = volumeGroupFacts(group, device);
  // TRANSLATORS: said under the name of a volume group the installation
  // creates, in a list headed "Volume groups".
  const newMark = !group.name ? _("New") : undefined;
  /* Only an existing group: the installation creates a new one even while it
     holds no logical volume yet. */
  const isIdle = !!group.name && !configModel.volumeGroup.usedMountPaths(group).length;

  return (
    <EntryRow
      name={<TruncatedDeviceName device={{ name: group.vgName }} maxLength={13} />}
      size={size}
      description={isGrouped ? newMark : description}
      usedFor={volumeGroupUsedFor(group)}
      isIdle={isIdle}
      existingData={<ExistingDataCell config={group} device={device} />}
      menu={<VolumeGroupMenu group={group} subject={subject} />}
      subject={subject}
    />
  );
}
