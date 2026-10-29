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
import { StackItem } from "@patternfly/react-core";
import CurrentContentSection, {
  hasCurrentContent,
} from "~/components/storage/device-details/CurrentContentSection";
import ExistingContent from "~/components/storage/device-details/ExistingContent";
import type { DeviceDetailsBodyProps } from "~/components/storage/device-details/DeviceDetailsBody";
import type { Partitionable } from "~/model/storage/config-model";

export default function UsedPartitionableCurrent({
  entry,
  subject,
}: DeviceDetailsBodyProps): React.ReactNode {
  const config = entry.config as Partitionable.Device;

  /* Given whole to a file system, the device loses every partition: nothing
     about them is left to decide. */
  if (hasCurrentContent(entry)) {
    return (
      <StackItem>
        <CurrentContentSection
          entry={entry}
          subject={subject}
          fixedDecision={config.mountPath ? "delete" : undefined}
        />
      </StackItem>
    );
  }

  /* Whatever is on the device goes, unless the new system takes the file
     system on it as it is. */
  const reusesFilesystem = !!config.mountPath && config.filesystem?.reuse === true;

  return <ExistingContent entry={entry} isDeleted={!reusesFilesystem} />;
}
