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
import { _ } from "~/i18n";
import type { DeviceDetailsBodyProps } from "~/components/storage/device-details/DeviceDetailsBody";

/**
 * A device the installation does not use yet: it says so, and offers the two
 * ways to start, partitioning it or giving it whole to one file system.
 */
export default function PartitionableNoContent({ subject }: DeviceDetailsBodyProps) {
  const params = {
    collection: subject.collection,
    index: String(subject.index),
  };

  return (
    <SummaryWithActions
      // TRANSLATORS: said of a device the installation does not use yet.
      summary={_("Not used by the installation yet")}
      // TRANSLATORS: says how a device the installation does not use yet can be
      // put to use.
      detail={_("Add partitions to it, or format it whole for a single file system.")}
      actions={
        <>
          <Link
            to={generateEncodedPath(PATHS.addPartition, params)}
            keepQuery
            variant="link"
            isInline
          >
            {_("Add partition")}
          </Link>
          <Link
            to={generateEncodedPath(PATHS.formatDevice, params)}
            keepQuery
            variant="link"
            isInline
          >
            {
              // TRANSLATORS: offered on a device nothing is planned on yet:
              // give the whole device to one file system, with no partitions.
              _("Format device")
            }
          </Link>
        </>
      }
    />
  );
}
