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
import Interpolate from "~/components/core/Interpolate";
import SheetSection from "~/components/storage/device-sheet/SheetSection";
import RelatedNames from "~/components/storage/shared/RelatedNames";
import { baseName } from "~/components/storage/utils";
import { useConfigModel } from "~/hooks/model/storage/config-model";
import configModel from "~/model/storage/config-model";
import { _ } from "~/i18n";
import type { DeviceDetailProps } from "~/components/storage/device-sheet/DeviceDetail";
import type { ConfigModel } from "~/model/storage/config-model";
import type { Related } from "~/components/storage/shared/users";

/**
 * Where a volume group being defined will find its room.
 *
 * A group the machine already has is read from the machine. A group being
 * defined has nothing to read: it exists only in the plan, and what a reader
 * wants to know about it is which disks it will stand on, because those are the
 * devices whose current content is at stake.
 *
 * So what is said here is not what the group holds but what it will take, named
 * disk by disk and reachable: a disk named in a sentence is a disk the reader
 * may want to open, and the panel they are in is not the one that decides what
 * happens to what is on it.
 *
 * "Any needed" rather than a count. How many partitions the group will take,
 * and how large, is settled by what is asked of it, and a number here would be
 * a promise this panel cannot keep.
 */
export default function VolumeGroupCurrent({ entry }: DeviceDetailProps): React.ReactNode {
  const config = useConfigModel();
  const volumeGroup = entry.config as ConfigModel.VolumeGroup;

  /* Each target is an entry of the plan in its own right, except where the
     group was pointed at a device the configuration says nothing else about. */
  const targets: Related[] = (volumeGroup.targetDevices || []).map((name) => ({
    name: baseName(name),
    subject: configModel.partitionable.findLocation(config, name) || undefined,
  }));

  return (
    <>
      {/* A count, not the list: a bare zero would be printed as text. */}
      {targets.length > 0 && (
        <SheetSection
          // TRANSLATORS: heading over the disks a volume group will take its
          // room from.
          title={_("Physical volumes")}
        >
          <div>
            <Interpolate
              // TRANSLATORS: says where a volume group being defined will make
              // room for itself. %s is a list of device names, such as "sda and
              // sdb".
              sentence={_("Any needed partition will be created at %s.")}
            >
              {() => <RelatedNames items={targets} />}
            </Interpolate>
          </div>
        </SheetSection>
      )}
      {volumeGroup.name && <div>{_("TODO: Existing volume group")}</div>}
    </>
  );
}
