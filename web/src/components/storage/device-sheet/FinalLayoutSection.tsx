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
import { Stack, StackItem } from "@patternfly/react-core";
import ProposalResultTable from "~/components/storage/ProposalResultTable";
import Text from "~/components/core/Text";
import { useDevicesManager } from "~/components/storage/shared/use-devices-manager";
import { baseName } from "~/components/storage/utils";
import { isVolumeGroup } from "~/model/storage/device";
import { _ } from "~/i18n";
import type { Entry } from "~/components/storage/device-sheet/entry";

export type FinalLayoutSectionProps = {
  entry: Entry;
};

/**
 * What this entry looks like once the installer has finished with it.
 *
 * The panel opens on this, so someone who came to check is already looking at
 * the answer and only someone who came to change has to move along. It is the
 * device's own slice of what the whole plan produces, on the device itself, so
 * "what will this disk actually look like" is answered without leaving the
 * thing the question is about.
 *
 * The same table the whole picture uses, narrowed to one entry. A device
 * described one way here and another way there is two devices as far as the
 * reader is concerned.
 */
export default function FinalLayoutSection({ entry }: FinalLayoutSectionProps): React.ReactNode {
  const manager = useDevicesManager();

  /* Matched by name rather than by sid: a volume group being defined has no sid
     yet, since the machine has nothing to give it one from, and it is exactly
     the entry a reader most wants to see the shape of. */
  const shown = manager
    .usedDevices()
    .filter((device) =>
      entry.isVolumeGroup
        ? isVolumeGroup(device) && baseName(device.name) === entry.name
        : device.name === entry.config.name,
    );

  return (
    <Stack hasGutter>
      <StackItem>
        <Text textStyle={["fontSizeSm", "textColorSubtle"]}>
          {/* TRANSLATORS: says what the panel's first view holds: the shape the
              device is left in once the installation has run. */}
          {_("After installing")}
        </Text>
      </StackItem>
      <StackItem>
        {shown.length ? (
          <ProposalResultTable devicesManager={manager} devices={shown} />
        ) : (
          <Text textStyle="textColorSubtle">
            {/* TRANSLATORS: said in place of the shape a device will be left in,
                where the installer has not worked one out. */}
            {_("There is no layout to show until the installer works one out.")}
          </Text>
        )}
      </StackItem>
    </Stack>
  );
}
