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
import { Flex } from "@patternfly/react-core";
import Link from "~/components/core/Link";
import DetailsSectionPart from "~/components/storage/device-details/DetailsSectionPart";
import PlannedActions from "~/components/storage/device-details/PlannedActions";
import PlannedContentSection from "~/components/storage/device-details/PlannedContentSection";
import UsedByStatement from "~/components/storage/device-details/UsedByStatement";
import BootStatement from "~/components/storage/device-details/BootStatement";
import { STORAGE as PATHS } from "~/routes/paths";
import configModel from "~/model/storage/config-model";
import { plannedOn } from "~/components/storage/device-details/planned";
import { usersOf } from "~/components/storage/shared/users";
import { useConfigModel } from "~/hooks/model/storage/config-model";
import { useFlattenDevices as useSystemDevices } from "~/hooks/model/system/storage";
import { _ } from "~/i18n";
import type { Partitionable } from "~/model/storage/config-model";
import type { DeviceDetailsBodyProps } from "~/components/storage/device-details/DeviceDetailsBody";

/**
 * Explains how the new system uses a disk on which it creates or reuses
 * partitions: the requested partitions first, then a paragraph for each other
 * role (LVM, booting), followed by one line of actions. Paragraphs rather than
 * a list, since the roles are different kinds of information.
 */
export default function PartitionableContent({
  entry,
  subject,
}: DeviceDetailsBodyProps): React.ReactNode {
  const config = useConfigModel();
  const systemDevices = useSystemDevices();
  const device = entry.config as Partitionable.Device;
  const hasPlanned = plannedOn(entry).length > 0;
  const users = usersOf(config, systemDevices, device.name);
  const isBoot = configModel.boot.hasDevice(config, entry.config.name);
  // TRANSLATORS: introduces the table of partitions planned on a disk.
  const caption = _("Partitions from the following list will be configured during installation");

  const changeBoot = isBoot && (
    <Link to={PATHS.editBootDevice} keepQuery variant="link" isInline>
      {/* TRANSLATORS: link to the settings of how the new system boots. */}
      {_("Change boot options")}
    </Link>
  );

  const hasNothingToSay = !hasPlanned && !users.length && !isBoot;

  return (
    <Flex direction={{ default: "column" }} gap={{ default: "gapSm" }}>
      {hasPlanned && (
        <DetailsSectionPart>
          <PlannedContentSection entry={entry} subject={subject} caption={caption} />
        </DetailsSectionPart>
      )}
      {!!users.length && (
        <DetailsSectionPart>
          <p>
            <UsedByStatement entry={entry} />
          </p>
        </DetailsSectionPart>
      )}
      {isBoot && (
        <DetailsSectionPart>
          <p>
            <BootStatement entry={entry} />
          </p>
        </DetailsSectionPart>
      )}
      {/* Said in a line, not as a table of headings over no rows. */}
      {hasNothingToSay && (
        <DetailsSectionPart>
          <p>{_("No new partitions planned yet.")}</p>
        </DetailsSectionPart>
      )}
      <PlannedActions entry={entry} subject={subject} extraActions={changeBoot} />
    </Flex>
  );
}
