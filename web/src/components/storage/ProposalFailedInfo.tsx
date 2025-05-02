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
import { IssueSeverity } from "~/types/issues";
import { useApiModel } from "~/hooks/storage/api-model";
import { useIssues, useConfigErrors } from "~/queries/issues";
import * as partitionUtils from "~/components/storage/utils/partition";
import { _, n_, formatList } from "~/i18n";
import { sprintf } from "sprintf-js";

const UnallocatablePartitions = ({ partitions, hasBoot }) => {
  const mountPaths = partitions.map((p) => partitionUtils.pathWithSize(p));

  return hasBoot
    ? sprintf(
        // TRANSLATORS: %s is a list of formatted mount points with size like
        // '"/" (at least 10 GiB), "/var" (20 GiB) and "swap" (2 GiB)' (or a
        // single mount point in the singular case).
        n_(
          "It is not possible to allocate the requested partition for booting and for %s.",
          "It is not possible to allocate the requested partitions for booting, %s.",
          mountPaths.length,
        ),
        formatList(mountPaths),
      )
    : sprintf(
        // TRANSLATORS: %s is a list of formatted mount points with size like
        // '"/" (at least 10 GiB), "/var" (20 GiB) and "swap" (2 GiB)' (or a
        // single mount point in the singular case).
        n_(
          "It is not possible to allocate the requested partition for %s.",
          "It is not possible to allocate the requested partitions for %s.",
          mountPaths.length,
        ),
        formatList(mountPaths),
      );
};

const UnallocatableVolumes = ({ logicalVolumes, hasBoot }) => {
  const mountPaths = logicalVolumes.map((lv) => partitionUtils.pathWithSize(lv));

  return hasBoot
    ? sprintf(
        // TRANSLATORS: %s is a list of formatted mount points with size like
        // '"/" (at least 10 GiB), "/var" (20 GiB) and "swap" (2 GiB)' (or a
        // single mount point in the singular case).
        n_(
          "It is not possible to allocate the requested partition for booting and volume for %s.",
          "It is not possible to allocate the requested partition for booting and volumes %s.",
          mountPaths.length,
        ),
        formatList(mountPaths),
      )
    : sprintf(
        // TRANSLATORS: %s is a list of formatted mount points with size like
        // '"/" (at least 10 GiB), "/var" (20 GiB) and "swap" (2 GiB)' (or a
        // single mount point in the singular case).
        n_(
          "It is not possible to allocate the requested volume for %s.",
          "It is not possible to allocate the requested volumes for %s.",
          mountPaths.length,
        ),
        formatList(mountPaths),
      );
};

const UnallocatableFileSystems = ({ devices, hasBoot }) => {
  const mountPaths = devices.map((d) => partitionUtils.pathWithSize(d));

  return hasBoot
    ? sprintf(
        // TRANSLATORS: %s is a list of formatted mount points with size like
        // '"/" (at least 10 GiB), "/var" (20 GiB) and "swap" (2 GiB)' (or a
        // single mount point in the singular case).
        n_(
          "It is not possible to allocate the requested partition for booting and file system for %s.",
          "It is not possible to allocate the requested partition for booting and file systems %s.",
          mountPaths.length,
        ),
        formatList(mountPaths),
      )
    : sprintf(
        // TRANSLATORS: %s is a list of formatted mount points with size like
        // '"/" (at least 10 GiB), "/var" (20 GiB) and "swap" (2 GiB)' (or a
        // single mount point in the singular case).
        n_(
          "It is not possible to allocate the requested file system for %s.",
          "It is not possible to allocate the requested file systems for %s.",
          mountPaths.length,
        ),
        formatList(mountPaths),
      );
};

const Description = () => {
  const model = useApiModel({ suspense: true });
  const partitions = model.drives.flatMap((d) => d.partitions || []);
  const logicalVolumes = model.volumeGroups.flatMap((vg) => vg.logicalVolumes || []);

  const newPartitions = partitions.filter((p) => !p.name);
  // FIXME: Currently, it's not possible to reuse a logical volume, so all
  // volumes are treated as new. This code cannot be made future-proof due to an
  // internal decision not to expose unused properties, even though "#name" is
  // used to infer whether a "device" is new or not.
  // const newLogicalVolumes = logicalVolumes.filter((lv) => !lv.name);

  const hasBoot = !!model.boot?.configure;
  const hasPartitions = newPartitions.length !== 0;
  const hasVolumes = logicalVolumes.length !== 0;

  if (!hasPartitions && !hasVolumes) {
    return (
      <Content component="p">
        {_(
          "It is not possible to install the system with the current configuration. Adjust the settings below.",
        )}
      </Content>
    );
  }

  return (
    <>
      <Content component="p">
        {hasPartitions && !hasVolumes && (
          <UnallocatablePartitions partitions={newPartitions} hasBoot={hasBoot} />
        )}
        {!hasPartitions && hasVolumes && (
          <UnallocatableVolumes logicalVolumes={logicalVolumes} hasBoot={hasBoot} />
        )}
        {hasPartitions && hasVolumes && (
          <UnallocatableFileSystems
            devices={[newPartitions, logicalVolumes].flat()}
            hasBoot={hasBoot}
          />
        )}
      </Content>
      <Content component="p">
        {_("Adjust the settings below to make the new system fit into the available space.")}
      </Content>
    </>
  );
};

/**
 * Information about a failed storage proposal
 *
 */
export default function ProposalFailedInfo() {
  const configErrors = useConfigErrors("storage");
  const errors = useIssues("storage").filter((s) => s.severity === IssueSeverity.Error);

  if (configErrors.length) return;
  if (!errors.length) return;

  return (
    <Alert variant="warning" title={_("Failed to calculate a storage layout")}>
      <Description />
    </Alert>
  );
}
