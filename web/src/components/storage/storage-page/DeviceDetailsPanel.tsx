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
import SidePanel from "~/components/core/SidePanel";
import DeviceDetailsHeading from "~/components/storage/device-details/DeviceDetailsHeading";
import DeviceDetailsBody from "~/components/storage/device-details/DeviceDetailsBody";
import DriveMenu from "~/components/storage/entries-table/DriveMenu";
import VolumeGroupMenu from "~/components/storage/entries-table/VolumeGroupMenu";
import { useEntry } from "~/components/storage/device-details/entry";
import { driveDescription, volumeGroupFacts } from "~/components/storage/utils/device";
import { useDeviceDetails, DETAILS_PANEL_ID } from "~/components/storage/shared/use-device-details";
import type { ConfigModel, Partitionable } from "~/model/storage/config-model";
import type { Entry } from "~/components/storage/device-details/entry";

/** The line under the panel title, matching the one under the row name. */
function entryDescription(entry: Entry): string | undefined {
  if (entry.isVolumeGroup) {
    return volumeGroupFacts(entry.config as ConfigModel.VolumeGroup, entry.device).description;
  }

  return entry.device ? driveDescription(entry.device) : undefined;
}

export type DeviceDetailsPanelProps = {
  /** The page the panel opens over. */
  page: React.ReactNode;
  /** How far below the top of the page the panel stays as it scrolls. See `SidePanel`. */
  pinnedOffset?: number;
};

/**
 * The panel with the details of the storage entry named in the address.
 *
 * An address naming an entry that no longer exists, because it was shared,
 * reloaded or removed from the panel itself, closes the panel and clears the
 * address.
 */
export default function DeviceDetailsPanel({
  page,
  pinnedOffset,
}: DeviceDetailsPanelProps): React.ReactNode {
  const { subject, isStale, close, keyOf } = useDeviceDetails();
  const entry = useEntry(subject);

  const isOpen = entry !== null;

  /* Replaces the address, so Back does not lead to an entry that is gone. */
  React.useEffect(() => {
    if (isStale) close();
  }, [isStale, close]);

  /* Focus returns to the row menu of the entry, also when the panel moved to
     another entry. */
  const key = subject && keyOf(subject);
  const rowMenu = () =>
    key
      ? document.querySelector<HTMLElement>(`[data-entry-menu="${CSS.escape(key)}"] button`)
      : null;

  return (
    <SidePanel
      id={DETAILS_PANEL_ID}
      returnFocusTo={rowMenu}
      subjectKey={key}
      pinnedOffset={pinnedOffset}
      isOpen={isOpen}
      onClose={close}
      title={entry && <DeviceDetailsHeading entry={entry} />}
      description={entry && entryDescription(entry)}
      /* The same menu as the entry row. */
      actions={
        entry &&
        (entry.isVolumeGroup ? (
          <VolumeGroupMenu group={entry.config as ConfigModel.VolumeGroup} />
        ) : (
          <DriveMenu entry={entry.config as Partitionable.Device} />
        ))
      }
      page={page}
    >
      {entry && subject && <DeviceDetailsBody entry={entry} subject={subject} />}
    </SidePanel>
  );
}
