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
import Link from "~/components/core/Link";
import CurrentContentSection, {
  hasCurrentContent,
} from "~/components/storage/device-sheet/CurrentContentSection";
import ExistingContent from "~/components/storage/device-sheet/ExistingContent";
import { STORAGE as PATHS } from "~/routes/paths";
import { generateEncodedPath } from "~/utils";
import { _ } from "~/i18n";
import type { DeviceDetailProps } from "~/components/storage/device-sheet/DeviceDetail";

/**
 * What a device holds today, where the installation does not use it yet.
 *
 * Nothing on it is touched, so what is found is said as kept. A file system on
 * the whole device can be put to use as it is, so it is offered to mount.
 */
export default function UnusedPartitionableCurrent({ entry, subject }: DeviceDetailProps) {
  /* Its partitions all stay, and any of them can be put to use. */
  if (hasCurrentContent(entry))
    return <CurrentContentSection entry={entry} subject={subject} fixedDecision="keep" />;

  const formatPath = generateEncodedPath(PATHS.formatDevice, {
    collection: subject.collection,
    index: String(subject.index),
  });

  const mount = entry.device?.filesystem && (
    <Link to={formatPath} keepQuery variant="link" isInline>
      {/* TRANSLATORS: a link offered on a file system found on a whole device,
          leading to where it is used for the new system and given a place to
          mount it. */}
      {_("Mount")}
    </Link>
  );

  return <ExistingContent entry={entry} actions={mount} />;
}
