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
import type { Entry } from "~/components/storage/device-details/entry";

export type DeviceDetailsHeadingProps = {
  entry: Entry;
};

/**
 * The panel title: the entry name and size, shortened like in its row. A
 * volume group the installation creates has no size yet.
 */
export default function DeviceDetailsHeading({
  entry,
}: DeviceDetailsHeadingProps): React.ReactNode {
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
