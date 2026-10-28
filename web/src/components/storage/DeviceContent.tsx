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
import { Flex, Label } from "@patternfly/react-core";
import { deviceSystems } from "~/model/storage/device";
import { contentDescription, filesystemLabels } from "~/components/storage/utils/device";

import type { Storage } from "~/model/system";

/**
 * Displays a summary of a storage device's current content: a textual
 * description (e.g. partition table info or filesystem type), installed
 * system names, and filesystem labels.
 */
export default function DeviceContent({ device }: { device: Storage.Device }) {
  return (
    <Flex columnGap={{ default: "columnGapXs" }}>
      {contentDescription(device)}
      {deviceSystems(device).map((s, i) => (
        <Label key={`system-${i}`} isCompact>
          {s}
        </Label>
      ))}
      {filesystemLabels(device).map((s, i) => (
        <Label key={`label-${i}`} variant="outline" isCompact>
          {s}
        </Label>
      ))}
    </Flex>
  );
}
