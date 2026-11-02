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
import { Content, List, ListItem } from "@patternfly/react-core";
import AlertWithDetailsPopup from "~/components/core/AlertWithDetailsPopup";
import { useConfigModel } from "~/hooks/model/storage/config-model";
import { useAvailableDevices, useVolumeTemplates } from "~/hooks/model/system/storage";
import * as partitionUtils from "~/components/storage/utils/partition";
import { _, n_, formatList } from "~/i18n";
import { formattedPath } from "~/components/storage/utils";
import type { TranslatedString } from "~/i18n";
import { sprintf } from "sprintf-js";

function snapshotsRelevant(volumes, partitions) {
  const rootOutline = volumes.find((v) => v.mountPath === "/")?.outline;
  if (!rootOutline) return false;

  const snapshotsConfigurable = rootOutline.fsTypes.filter((t) => t.startsWith("btrfs")).length > 1;
  if (!rootOutline.snapshotsAffectSizes || !snapshotsConfigurable) return false;

  const rootPartition = partitions.find((p) => p.mountPath === "/");
  if (!rootPartition) return false;

  const fsType = rootPartition.filesystem.type;
  const withSnapshots = fsType.startsWith("btrfs") && fsType !== "btrfs";
  return withSnapshots && rootPartition.size.default;
}

function ramAffectedPaths(volumes, partitions) {
  const volumePaths = volumes.filter((v) => v.outline?.adjustByRam).map((v) => v.mountPath);
  if (!volumePaths.length) return [];

  const ramParts = partitions.filter((p) => volumePaths.includes(p.mountPath) && p.size.default);
  return ramParts.map((p) => p.mountPath);
}

function SizeExplanations() {
  const volumes = useVolumeTemplates();
  const model = useConfigModel();
  const partitions = model.drives.flatMap((d) => d.partitions || []);

  const snapshots = snapshotsRelevant(volumes, partitions);
  const ramPaths = ramAffectedPaths(volumes, partitions);

  if (!snapshots && !ramPaths.length) return;

  if (snapshots && ramPaths.length === 1 && ramPaths[0] === "/") {
    return (
      <Content component="p">
        {sprintf(
          // TRANSLATORS: %s is the formatted mount point for root, '"/"
          _(
            "Bear in mind the automatically calculated sizes of the partition for %s is influenced by the usage of Btrfs snapshots and the amount of RAM in the system.",
          ),
          formattedPath("/"),
        )}
      </Content>
    );
  }

  if (snapshots && ramPaths.length) {
    return (
      <Content component="p">
        {sprintf(
          // TRANSLATORS: %s is the formatted mount point for root, '"/"
          _(
            "Bear in mind the automatically calculated sizes of some partitions are influenced by the amount of RAM in the system and, in the case of %s, by the usage of Btrfs snapshots.",
          ),
          formattedPath("/"),
        )}
      </Content>
    );
  }

  if (snapshots) {
    return (
      <Content component="p">
        {sprintf(
          // TRANSLATORS: %s is the formatted mount point for root, '"/"
          _(
            "Bear in mind that using Btrfs snapshots results in a bigger auto-calculated size of the partition for %s.",
          ),
          formattedPath("/"),
        )}
      </Content>
    );
  }

  return (
    <Content component="p">
      {sprintf(
        // TRANSLATORS: %s (used only in the singular case) is a formatted mount point like "/home"
        n_(
          "Bear in mind the automatically calculated sizes of the partition for '%s' is influenced by the amount of RAM in the system",
          "Bear in mind the automatically calculated sizes of some partitions are influenced by the amount of RAM in the system",
          ramPaths.length,
        ),
        formattedPath(ramPaths[0]),
      )}
    </Content>
  );
}

function PossibleActions() {
  // Some logic that may be needed to calculate the conditions below
  const model = useConfigModel();
  const drives = model.drives;
  const drivesNames = drives.map((d) => d.name);
  const disks = useAvailableDevices();
  const diskPartitions = disks
    .filter((d) => drivesNames.includes(d.name))
    .flatMap((d) => d.partitions || []);
  const drivePartitions = drives.flatMap((d) => d.partitions || []);
  const deletedDrivePartitions = drivePartitions.filter(
    (p) => p.name && (p.delete || p.deleteIfNeeded),
  );

  const actions = [];
  if (deletedDrivePartitions.length < diskPartitions.length) {
    actions.push(
      _("Trying to find more space by configuring more partitions to be deleted or shrunk."),
    );
  }
  if (drives.length === 1 && disks.length > 1) {
    actions.push(
      _("Installing into another disk or distributing the partitions over several disks."),
    );
  }
  if (drives.length > 1) {
    actions.push(_("Changing the way the partitions are distributed on the different disks."));
  }

  if (actions.length) {
    actions.push(_("Changing the partitions or adjusting its size limits."));

    return (
      <>
        <Content component="p">
          {_("Consider adjusting one or several of the following aspects.")}
        </Content>
        <List>
          {actions.map((action, i) => (
            <ListItem key={i}>{action}</ListItem>
          ))}
        </List>
      </>
    );
  }

  return <Content component="p">{_("Change the partitions or adjust its size limits.")}</Content>;
}

const Intro = () => {
  const model = useConfigModel();
  const partitions = model.drives.flatMap((d) => d.partitions || []);
  const logicalVolumes = model.volumeGroups.flatMap((vg) => vg.logicalVolumes || []);
  const isBootConfigured = !!model.boot?.configure;
  const mountPaths = [...partitions, ...logicalVolumes]
    .filter((p) => !p.name)
    .flat()
    .map((d) => partitionUtils.pathWithSize(d));

  return (
    <Content component="p">
      {sprintf(
        isBootConfigured
          ? // TRANSLATORS: %s is a list of formatted mount points with a partition size like
            // '"/" (at least 10 GiB), "/var" (20 GiB) and "swap" (2 GiB)'
            _("Applying the configuration implies allocating the boot partition and also %s.")
          : // TRANSLATORS: %s is a list of formatted mount points with a partition size like
            // '"/" (at least 10 GiB), "/var" (20 GiB) and "swap" (2 GiB)'
            _("Applying the configuration implies allocating %s."),
        formatList(mountPaths),
      )}
    </Content>
  );
};

const Description = () => {
  return (
    <>
      <Intro />
      <PossibleActions />
      <SizeExplanations />
    </>
  );
};

/** The one line saying that no layout could be worked out. */
function proposalFailedTitle(): TranslatedString {
  // TRANSLATORS: reported at the top of the storage page when the installer
  // cannot work out how to lay out the disks for the new system.
  return _("The configuration cannot be applied");
}

/**
 * Displays information to help users understand why a storage proposal
 * could not be generated with the current configuration.
 *
 * The line says only what the problem is. What does not fit, and what to do
 * about it, is one action away.
 *
 * TODO: the whole component needs to be revisited. Right now is reusing code
 * and strings from an old experiment.
 */
export default function ProposalFailedInfo() {
  return (
    <AlertWithDetailsPopup
      variant="warning"
      title={proposalFailedTitle()}
      // TRANSLATORS: opens a popup explaining why no storage layout can be
      // calculated.
      actionLabel={_("Show details")}
      // TRANSLATORS: the full name of the "Show more" action, read by screen
      // readers. It must start with the same words as the translation of "Show
      // more", so that people using speech input can say what they see.
      actionAriaLabel={_("Show details about the failed storage calculation.")}
      // TRANSLATORS: title of the popup explaining why no storage layout can be
      // calculated.
      popupTitle={_("Failed to plan storage changes")}
    >
      <Description />
    </AlertWithDetailsPopup>
  );
}

export { proposalFailedTitle };
