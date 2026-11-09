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
import {
  driveUsedFor,
  existingDataOfDrive,
  ExistingDataCell,
} from "~/components/storage/entries-table/cells";
import { deviceSize } from "~/components/storage/utils";
import { driveDescription, typeDescription } from "~/components/storage/utils/device";
import { useConfigModel } from "~/hooks/model/storage/config-model";
import {
  useExistingDataWording,
  useGroupedTable,
  useNamesStyle,
} from "~/components/storage/storage-page/playground-switches";
import { useDevice } from "~/hooks/model/system/storage";
import TruncatedDeviceName from "~/components/storage/TruncatedDeviceName";
import configModel from "~/model/storage/config-model";
import type { DetailsSubject } from "~/components/storage/shared/use-device-details";

export type DriveRowProps = {
  /** The device the configuration names, as the model spells it. */
  name: string;
  /** Where it is written, which is how the panel is opened on it. */
  subject: DetailsSubject;
};

/**
 * A disk or a software RAID, as a row of the list.
 *
 * Split from the volume group's row rather than switched inside one component.
 * Both read the machine, and a single row deciding what it is looking at would
 * call a different number of hooks depending on the answer.
 *
 * How big it is is read beside the name, and what it is under it: the vendor
 * model where the machine reports one, and the kind of device where it does
 * not. A configuration can name a device the machine does not have, a
 * profile written elsewhere or a disk since unplugged, so both are left out
 * where there is nothing to say.
 */
export default function DriveRow({ name, subject }: DriveRowProps): React.ReactNode {
  const config = useConfigModel();
  const device = useDevice(name);

  const entry = configModel.partitionable.findByName(config, name);
  const size = device?.block?.size ? deviceSize(device.block.size) : undefined;
  /* PLAYGROUND: in the grouped table the group's title already says these are
     disks, so a disk whose description is only its kind ("Disk", whether from
     a missing model or a model reported as just that) says nothing under its
     name. RAID devices keep theirs, which carries their level. */
  const isGrouped = useGroupedTable() === "on";
  const fullDescription = device && driveDescription(device);
  const isOnlyKind =
    isGrouped && subject.collection === "drives" && fullDescription === typeDescription(device);
  const description = isOnlyKind ? undefined : fullDescription;

  const groups = entry ? configModel.partitionable.filterVolumeGroups(config, entry) : [];
  const boots = configModel.boot.hasDevice(config, name);
  const isIdle = !!entry && !configModel.partitionable.isUsed(config, name);
  const namesStyle = useNamesStyle();
  const usedFor = entry
    ? driveUsedFor(
        entry,
        groups.map((group) => group.vgName),
        boots,
        isIdle,
        namesStyle,
      )
    : [];
  const wording = useExistingDataWording();
  const existingData = entry && (
    <ExistingDataCell data={existingDataOfDrive(entry, device)} wording={wording} />
  );

  return (
    <EntryRow
      name={<TruncatedDeviceName device={device || { name }} maxLength={13} />}
      size={size}
      description={description}
      usedFor={usedFor}
      isIdle={isIdle}
      existingData={existingData}
      menu={entry && <DriveMenu entry={entry} subject={subject} device={device} />}
      subject={subject}
    />
  );
}
