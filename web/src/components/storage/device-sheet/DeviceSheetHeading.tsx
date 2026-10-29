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
import Text from "~/components/core/Text";
import TruncatedDeviceName from "~/components/storage/TruncatedDeviceName";
import { deviceSize } from "~/components/storage/utils";
import { volumeGroupFacts } from "~/components/storage/utils/device";
import type { ConfigModel } from "~/model/storage/config-model";
import type { Entry } from "~/components/storage/device-sheet/entry";

export type DeviceSheetHeadingProps = {
  entry: Entry;
};

/**
 * Which entry the sheet is about, said exactly the way its row says it.
 *
 * The same name, shortened the same way, and the same size beside it, so the
 * row a reader opened and the panel that opens are visibly the same thing. The
 * sheet can cover the list, and then this is what keeps the entry at hand.
 *
 * A volume group the machine has carries its size too, as in its row; one
 * being created has none yet (see {@link volumeGroupFacts}).
 */
export default function DeviceSheetHeading({ entry }: DeviceSheetHeadingProps): React.ReactNode {
  const { device, name, isVolumeGroup } = entry;
  const size = isVolumeGroup
    ? volumeGroupFacts(entry.config as ConfigModel.VolumeGroup, device).size
    : device?.block?.size && deviceSize(device.block.size);

  return (
    <>
      <Text isBold>
        <TruncatedDeviceName device={{ name }} maxLength={13} />
      </Text>
      {size && <> · {size}</>}
    </>
  );
}
