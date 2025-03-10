/*
 * Copyright (c) [2025] SUSE LLC
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
import { Alert, Content } from "@patternfly/react-core";
import { _, n_, formatList } from "~/i18n";
import { useIssues, useConfigErrors } from "~/queries/issues";
import { useConfigModel } from "~/queries/storage/config-model";
import { IssueSeverity } from "~/types/issues";
import * as partitionUtils from "~/components/storage/utils/partition";
import { sprintf } from "sprintf-js";

function Description({ partitions }) {
  const newPartitions = partitions.filter((p) => !p.name);

  if (!newPartitions.length) {
    return (
      <Content component="p">
        {_(
          "It is not possible to install the system with the current configuration. Adjust the settings below.",
        )}
      </Content>
    );
  }

  const mountPaths = newPartitions.map((p) => partitionUtils.pathWithSize(p));
  const msg1 = sprintf(
    // TRANSLATORS: %s is a list of formatted mount points with a partition size like
    // '"/" (at least 10 GiB), "/var" (20 GiB) and "swap" (2 GiB)'
    // (or a single mount point in the singular case).
    n_(
      "It is not possible to allocate the requested partition for %s.",
      "It is not possible to allocate the requested partitions for %s.",
      mountPaths.length,
    ),
    formatList(mountPaths),
  );

  return (
    <>
      <Content component="p">{msg1}</Content>
      <Content component="p">
        {_("Adjust the settings below to make the new system fit into the available space.")}
      </Content>
    </>
  );
}

/**
 * Information about a failed storage proposal
 *
 */
export default function ProposalFailedInfo() {
  const configErrors = useConfigErrors("storage");
  const errors = useIssues("storage").filter((s) => s.severity === IssueSeverity.Error);
  const model = useConfigModel({ suspense: true });

  if (configErrors.length) return;
  if (!errors.length) return;

  const modelPartitions = model.drives.flatMap((d) => d.partitions || []);

  return (
    <Alert variant="warning" title={_("Failed to calculate a storage layout")}>
      <Description partitions={modelPartitions} />
    </Alert>
  );
}
