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

/**
 * What the entry is, under its name, as its row says it under the name: a
 * disk's model or kind, or for a volume group its kind or that it is to be
 * created.
 */
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
 * The one panel the storage page opens, on whichever entry the reader picked.
 *
 * It holds the details of that entry and nothing else. What the whole
 * configuration does is reported above the page, not here.
 *
 * One panel and not several, because the reader only ever has one open and the
 * address only ever names one thing. What changes with the entry is what the
 * panel says it is about and what it holds; how it behaves does not, which is
 * why that part is settled once in `core/SidePanel`.
 *
 * An address naming an entry the configuration no longer has reads as a shut
 * panel, and the name leaves the address, so the two always agree. Addresses
 * outlive plans: one can be written down, shared, or reloaded after the entry
 * it named has gone. The same goes for a change made from the panel itself
 * that takes its entry away: the panel closes rather than moving on to another
 * entry, since going from one entry to another is always the reader's doing.
 */
export default function DeviceDetailsPanel({
  page,
  pinnedOffset,
}: DeviceDetailsPanelProps): React.ReactNode {
  const { subject, isStale, close, keyOf } = useDeviceDetails();
  const entry = useEntry(subject);

  const isOpen = entry !== null;

  /* Replaced rather than pushed, as every change of the panel is, so Back does
     not lead to the address of an entry that is gone. */
  React.useEffect(() => {
    if (isStale) close();
  }, [isStale, close]);

  /* The menu of the entry's row, wherever the panel was opened from: after
     adding a device or moving to another one inside the panel, the reader
     lands on the entry they were last looking at. */
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
      /* The same acts the entry's row offers, so a reader meets one menu per
         entry wherever they open it from. */
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
