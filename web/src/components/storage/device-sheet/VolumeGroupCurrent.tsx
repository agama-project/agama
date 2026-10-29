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
import CurrentContentSection, {
  hasCurrentContent,
} from "~/components/storage/device-sheet/CurrentContentSection";
import { _ } from "~/i18n";
import type { DeviceDetailProps } from "~/components/storage/device-sheet/DeviceDetail";

/**
 * What a volume group the machine already has holds today: its logical
 * volumes, read like a disk's partitions, or a line saying it holds none.
 *
 * A group being created has nothing on it today; what defines it is said by
 * the Properties section instead.
 */
export default function VolumeGroupCurrent({ entry, subject }: DeviceDetailProps) {
  if (hasCurrentContent(entry)) return <CurrentContentSection entry={entry} subject={subject} />;

  // TRANSLATORS: said of an existing LVM volume group with nothing in it.
  return <p>{_("No logical volumes detected.")}</p>;
}
