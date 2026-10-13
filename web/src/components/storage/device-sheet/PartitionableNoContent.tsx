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
import {
  EmptyState,
  EmptyStateBody,
  EmptyStateActions,
  EmptyStateFooter,
} from "@patternfly/react-core";
import Link from "~/components/core/Link";
import Icon from "~/components/layout/Icon";
import SheetSection from "~/components/storage/device-sheet/SheetSection";
import { STORAGE as PATHS } from "~/routes/paths";
import { generateEncodedPath } from "~/utils";
import type { DeviceDetailProps } from "~/components/storage/device-sheet/DeviceDetail";
import { _ } from "~/i18n";

export default function PartitionableNoContent({
  entry,
  subject,
}: DeviceDetailProps): React.ReactNode {
  console.log("e", entry, "s", subject);

  const params = {
    collection: subject.collection,
    index: String(subject.index),
  };

  /* The same form the panel offers once there is something to list, reached
     the same way: a device with nothing planned on it yet is the one place a
     reader is most likely to want it, not a different act. */
  const addPath = generateEncodedPath(PATHS.addPartition, params);

  /* The other way to use a device, which is to give the whole of it to one
     file system and no partition table at all. */
  const formatPath = generateEncodedPath(PATHS.formatDevice, params);

  return (
    <SheetSection title={_("TODO")}>
      <EmptyState
        headingLevel="h4"
        variant="sm"
        titleText={_("This EmptyState should offer both formatting and partitioning")}
      >
        <EmptyStateBody>
          {_("Format, add a partition or reuse one of the partitions already in the disk.")}
        </EmptyStateBody>
        <EmptyStateFooter>
          <EmptyStateActions>
            <Link to={addPath} keepQuery variant="secondary" icon={<Icon name="add" size="xs" />}>
              {_("Add partition")}
            </Link>
            <Link
              to={formatPath}
              keepQuery
              variant="secondary"
              icon={<Icon name="hard_drive" size="xs" />}
            >
              {
                // TRANSLATORS: offered on a device nothing is planned on yet:
                // give the whole device to one file system, with no partitions.
                _("Format device")
              }
            </Link>
          </EmptyStateActions>
        </EmptyStateFooter>
      </EmptyState>
    </SheetSection>
  );
}
