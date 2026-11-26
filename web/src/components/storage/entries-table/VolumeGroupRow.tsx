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
  /** The volume group in the configuration. */
  group: ConfigModel.VolumeGroup;
  /** Where it is in the configuration. */
  subject: DetailsSubject;
  /** Whether the row is under a group title, so the line under the name only says whether it is new. */
  isGrouped?: boolean;
};

/**
 * The row of an LVM volume group. A group the installation creates has no
 * size and no existing data yet.
 */
export default function VolumeGroupRow({
  group,
  subject,
  isGrouped = false,
}: VolumeGroupRowProps): React.ReactNode {
  const device = useDevice(group.name || "");
  const { size, description } = volumeGroupFacts(group, device);
  // TRANSLATORS: marks a volume group the installation creates
  const newMark = !group.name ? _("New") : undefined;
  /* A new group is created even when it holds no logical volume yet. */
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
