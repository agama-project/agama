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
import DriveMenu from "~/components/storage/entries-table/DriveMenu";
import { driveUsedFor, ExistingDataCell } from "~/components/storage/entries-table/cells";
import { deviceSize } from "~/components/storage/utils";
import { driveDescription, typeDescription } from "~/components/storage/utils/device";
import { useConfigModel } from "~/hooks/model/storage/config-model";
import { useDevice } from "~/hooks/model/system/storage";
import TruncatedDeviceName from "~/components/storage/TruncatedDeviceName";
import configModel from "~/model/storage/config-model";
import type { DetailsSubject } from "~/components/storage/shared/use-device-details";

export type DriveRowProps = {
  /** The device name in the configuration. */
  name: string;
  /** Where it is in the configuration. */
  subject: DetailsSubject;
};

/**
 * The row of a disk or a software RAID. The line under the name is the model,
 * or the kind of device when there is no model. A device missing from the
 * system, such as an unplugged disk, shows neither size nor description.
 */
export default function DriveRow({ name, subject }: DriveRowProps): React.ReactNode {
  const config = useConfigModel();
  const device = useDevice(name);

  const entry = configModel.partitionable.findByName(config, name);
  const size = device?.block?.size ? deviceSize(device.block.size) : undefined;
  const fullDescription = device && driveDescription(device);
  const isOnlyKind =
    !!device && subject.collection === "drives" && fullDescription === typeDescription(device);
  const description = isOnlyKind ? undefined : fullDescription;

  const groups = entry ? configModel.partitionable.filterVolumeGroups(config, entry) : [];
  const boots = configModel.boot.hasDevice(config, name);
  const isIdle =
    !!entry &&
    !configModel.partitionable.isUsed(config, name) &&
    !configModel.boot.hasDevice(config, name);
  const usedFor = entry
    ? driveUsedFor(
        entry,
        groups.map((group) => group.vgName),
        boots,
        isIdle,
      )
    : [];
  const existingData = entry && <ExistingDataCell config={entry} device={device} isIdle={isIdle} />;

  return (
    <EntryRow
      name={<TruncatedDeviceName device={device || { name }} maxLength={13} />}
      size={size}
      description={description}
      usedFor={usedFor}
      isIdle={isIdle}
      existingData={existingData}
      menu={entry && <DriveMenu entry={entry} subject={subject} />}
      subject={subject}
    />
  );
}
