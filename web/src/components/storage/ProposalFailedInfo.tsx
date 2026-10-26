/*
 * Copyright (c) [2025-2026] SUSE LLC
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
import { Content } from "@patternfly/react-core";
import AlertWithDetailsPopup from "~/components/core/AlertWithDetailsPopup";
import { useConfigModel } from "~/hooks/model/storage/config-model";
import * as partitionUtils from "~/components/storage/utils/partition";
import { _, formatList } from "~/i18n";
import type { TranslatedString } from "~/i18n";
import { sprintf } from "sprintf-js";

const Description = () => {
  const model = useConfigModel();
  const partitions = model.drives.flatMap((d) => d.partitions || []);
  const logicalVolumes = model.volumeGroups.flatMap((vg) => vg.logicalVolumes || []);
  const isBootConfigured = !!model.boot?.configure;
  const mountPaths = [...partitions, ...logicalVolumes]
    .filter((p) => !p.name)
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

/** The one line saying that no layout could be worked out. */
function proposalFailedTitle(): TranslatedString {
  // TRANSLATORS: reported at the top of the storage page when the installer
  // cannot work out how to lay out the disks for the new system.
  return _("No storage layout can be calculated with the current settings.");
}

/**
 * Displays information to help users understand why a storage proposal
 * could not be generated with the current configuration.
 *
 * The line says only what the problem is. What does not fit, and what to do
 * about it, is one action away.
 */
export default function ProposalFailedInfo() {
  return (
    <AlertWithDetailsPopup
      variant="warning"
      title={proposalFailedTitle()}
      // TRANSLATORS: opens a popup explaining why no storage layout can be
      // calculated.
      actionLabel={_("Show more")}
      // TRANSLATORS: the full name of the "Show more" action, read by screen
      // readers. It must start with the same words as the translation of "Show
      // more", so that people using speech input can say what they see.
      actionAriaLabel={_("Show more about the storage layout")}
      // TRANSLATORS: title of the popup explaining why no storage layout can be
      // calculated.
      popupTitle={_("Storage layout not calculated")}
    >
      <Description />
    </AlertWithDetailsPopup>
  );
}

export { proposalFailedTitle };
