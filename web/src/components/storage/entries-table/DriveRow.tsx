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
import { baseName, deviceSize } from "~/components/storage/utils";
import { typeDescription } from "~/components/storage/utils/device";
import { useDevice } from "~/hooks/model/system/storage";

export type DriveRowProps = {
  /** The device the configuration names, as the model spells it. */
  name: string;
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
export default function DriveRow({ name }: DriveRowProps): React.ReactNode {
  const device = useDevice(name);

  const description = [
    device?.block?.size && deviceSize(device.block.size),
    device && typeDescription(device),
    device?.partitionTable?.type?.toUpperCase(),
  ]
    .filter(Boolean)
    .join("  ·  ");

  return <EntryRow name={baseName(name)} description={description} />;
}
