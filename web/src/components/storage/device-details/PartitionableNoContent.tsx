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
import SummaryWithActions from "~/components/storage/device-details/SummaryWithActions";
import { STORAGE as PATHS } from "~/routes/paths";
import { generateEncodedPath } from "~/utils";
import { sprintf } from "sprintf-js";
import { filesystemLabel } from "~/components/storage/utils";
import CurrentContentSection, {
  hasCurrentContent,
} from "~/components/storage/device-details/CurrentContentSection";
import { _ } from "~/i18n";
import type { DeviceDetailsBodyProps } from "~/components/storage/device-details/DeviceDetailsBody";

/**
 * A device the installation does not use yet: says what can be done with it
 * and offers the ways to start.
 */
export default function PartitionableNoContent({ entry, subject }: DeviceDetailsBodyProps) {
  const params = {
    collection: subject.collection,
    index: String(subject.index),
  };
  const isCurrentlyPartitioned = hasCurrentContent(entry);
  const isCurrentlyFormatted = !!entry.device?.filesystem;

  const summary = isCurrentlyPartitioned
    ? _(
        "Define some partitions to be created, mounted or formatted during instalation, or set the device to be formatted with no partitions.",
      )
    : isCurrentlyFormatted
      ? sprintf(
          // TRANSLATORS: %s is a filesystem type like "Ext4" or "Btrfs"
          _(
            "Define some partitions, format the whole device or mount the existing %s file system.",
          ),
          filesystemLabel(entry.device.filesystem.type),
        )
      : _("Define some partitions or format the whole device.");

  const actions = (
    <>
      <Link to={generateEncodedPath(PATHS.addPartition, params)} keepQuery variant="link" isInline>
        {_("Add partition")}
      </Link>
      <Link to={generateEncodedPath(PATHS.formatDevice, params)} keepQuery variant="link" isInline>
        {isCurrentlyFormatted ? _("Format or mount") : _("Format device")}
      </Link>
    </>
  );

  if (isCurrentlyPartitioned) {
    return (
      <>
        <SummaryWithActions summary={summary} actions={actions} />
        <CurrentContentSection
          entry={entry}
          subject={subject}
          fixedDecision="keep"
          withSummary={false}
        />
      </>
    );
  }

  return <SummaryWithActions summary={summary} actions={actions} />;
}
