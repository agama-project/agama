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
import { useConfigModel } from "~/hooks/model/storage/config-model";
import * as partitionUtils from "~/components/storage/utils/partition";
import { _, formatList } from "~/i18n";
import { sprintf } from "sprintf-js";

const Description = () => {
  const model = useConfigModel();
  const partitions = model.drives.flatMap((d) => d.partitions || []);
  const logicalVolumes = model.volumeGroups.flatMap((vg) => vg.logicalVolumes || []);

  const newPartitions = partitions.filter((p) => !p.name);

  // FIXME: Currently, it's not possible to reuse a logical volume, so all
  // volumes are treated as new. This code cannot be made future-proof due to an
  // internal decision not to expose unused properties, even though "#name" is
  // used to infer whether a "device" is new or not.
  // const newLogicalVolumes = logicalVolumes.filter((lv) => !lv.name);

  const isBootConfigured = !!model.boot?.configure;
  const mountPaths = [newPartitions, logicalVolumes]
    .flat()
    .map((d) => partitionUtils.pathWithSize(d));

  if (mountPaths.length === 0) {
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
        {sprintf(
          isBootConfigured
            ? // TRANSLATORS: %s is a list of formatted mount points with a partition size like
              // '"/" (at least 10 GiB), "/var" (20 GiB) and "swap" (2 GiB)'
              _("It is not possible to allocate space for the boot partition and for %s.")
            : // TRANSLATORS: %s is a list of formatted mount points with a partition size like
              // '"/" (at least 10 GiB), "/var" (20 GiB) and "swap" (2 GiB)'
              _("It is not possible to allocate space for %s."),
          formatList(mountPaths),
        )}
      </Content>
      <Content component="p">
        {_("Adjust the settings below to make the new system fit into the available space.")}
      </Content>
    </>
  );
};

/**
 * Displays information to help users understand why a storage proposal
 * could not be generated with the current configuration.
 */
export default function ProposalFailedInfo() {
  return (
    <Alert variant="warning" title={_("Failed to calculate a storage layout")}>
      <Description />
    </Alert>
  );
}
