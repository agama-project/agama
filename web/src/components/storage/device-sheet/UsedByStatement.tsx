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
import RelatedNames from "~/components/storage/shared/RelatedNames";
import Interpolate from "~/components/core/Interpolate";
import SheetItem from "~/components/storage/device-sheet/SheetItem";
import { usersOf } from "~/components/storage/shared/users";
import { useConfigModel } from "~/hooks/model/storage/config-model";
import { useFlattenDevices as useSystemDevices } from "~/hooks/model/system/storage";
import { _ } from "~/i18n";
import type { Entry } from "~/components/storage/device-sheet/entry";
import type { Partitionable } from "~/model/storage/config-model";

export type UsedByStatementProps = {
  entry: Entry;
};

/**
 * Which other entries of the plan are built on this device, and the way to each.
 *
 * A disk given whole to a volume group holds nothing of its own, so where its
 * plan is decided is the one thing a reader opening it most needs told. A volume
 * group is the top of its own stack and has nobody above it, so it says nothing.
 *
 * It decides for itself whether it has anything to say, so a view can list it
 * among its statements without working that out first.
 */
export default function UsedByStatement({ entry }: UsedByStatementProps): React.ReactNode {
  const config = useConfigModel();
  const systemDevices = useSystemDevices();

  if (entry.isVolumeGroup) return null;

  const users = usersOf(config, systemDevices, (entry.config as Partitionable.Device).name);
  if (users.length === 0) return null;

  return (
    <SheetItem
      icon="stacks"
      // TRANSLATORS: names the volume management on a disk, in its panel.
      name={_("LVM")}
      value={
        <Interpolate
          // TRANSLATORS: follows "LVM" in a disk's panel. %s is the name of one
          // or more volume groups, such as "system", each a link to its panel.
          sentence={_("physical volumes for %s")}
        >
          {() => <RelatedNames items={users} />}
        </Interpolate>
      }
    >
      {/* TRANSLATORS: says how the room for a volume group is taken from a
          disk. */}
      {_("Partitions are created here as needed.")}
    </SheetItem>
  );
}
