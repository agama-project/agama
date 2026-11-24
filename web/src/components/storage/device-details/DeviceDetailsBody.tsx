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
import Text from "~/components/core/Text";
import ExistingContent from "~/components/storage/device-details/ExistingContent";
import DetailsSection from "~/components/storage/device-details/DetailsSection";
import CurrentContentSection, {
  hasCurrentContent,
} from "~/components/storage/device-details/CurrentContentSection";
import PropertiesSection from "~/components/storage/device-details/PropertiesSection";
import PartitionableContent from "~/components/storage/device-details/PartitionableContent";
import PartitionableNoContent from "~/components/storage/device-details/PartitionableNoContent";
import PartitionableMountContent from "~/components/storage/device-details/PartitionableMountContent";
import VolumeGroupContent from "~/components/storage/device-details/VolumeGroupContent";
import configModel from "~/model/storage/config-model";
import { useConfigModel } from "~/hooks/model/storage/config-model";
import { _ } from "~/i18n";
import type { ConfigModel, Partitionable } from "~/model/storage/config-model";
import type { Entry } from "~/components/storage/device-details/entry";
import type { DetailsSubject } from "~/components/storage/shared/use-device-details";

export type DeviceDetailsBodyProps = {
  entry: Entry;
  /** Where the entry is in the storage configuration, used to add, edit or delete its parts. */
  subject: DetailsSubject;
};

function Intro({ children }): React.ReactNode {
  return <Text textStyle={["fontSizeXs", "textColorSubtle"]}>{children}</Text>;
}

function Body({ children }): React.ReactNode {
  return (
    <Flex direction={{ default: "column" }} gap={{ default: "gapLg" }}>
      {children}
    </Flex>
  );
}

export default function DeviceDetailsBody({
  entry,
  subject,
}: DeviceDetailsBodyProps): React.ReactNode {
  const config = useConfigModel();

  if (entry.isVolumeGroup) {
    if ((entry.config as ConfigModel.VolumeGroup).name) {
      const newLVsSection = (
        <DetailsSection title={_("Logical volumes for the new system")}>
          <VolumeGroupContent entry={entry} subject={subject} />
        </DetailsSection>
      );

      if (hasCurrentContent(entry)) {
        return (
          <Body>
            <Intro>
              {_(
                "Define logical volumes for the new system, existing volumes can be deleted or reduced to make space for the new system or can be used by it.",
              )}
            </Intro>
            {newLVsSection}
            <DetailsSection title={_("Current logical volumes")}>
              <CurrentContentSection entry={entry} subject={subject} />
            </DetailsSection>
          </Body>
        );
      }

      return (
        <Body>
          <Intro>{_("Define logical volumes for the new system.")}</Intro>
          {newLVsSection}
          <DetailsSection title={_("Current logical volumes")}>
            <p>{_("No logical volumes detected.")}</p>
          </DetailsSection>
        </Body>
      );
    }

    return (
      <Body>
        <Intro>
          {_("Customize how the new volume group will be created and define its logical volumes.")}
        </Intro>
        <DetailsSection title={_("Properties")}>
          <PropertiesSection entry={entry} subject={subject} />
        </DetailsSection>
        <DetailsSection title={_("Logical volumes")}>
          <VolumeGroupContent entry={entry} subject={subject} />
        </DetailsSection>
      </Body>
    );
  }

  const partitionable = entry.config as Partitionable.Device;
  const isCurrentlyPartitioned = hasCurrentContent(entry);
  const basicIntro = _(
    "Customize how the system will use this disk, any current content may be affected.",
  );

  if (partitionable.mountPath) {
    if (partitionable.filesystem?.reuse === true) {
      return (
        <Body>
          <Intro>{basicIntro}</Intro>
          <DetailsSection title={_("File system")}>
            <PartitionableMountContent entry={entry} subject={subject} />
          </DetailsSection>
        </Body>
      );
    }

    return (
      <Body>
        <Intro>{basicIntro}</Intro>
        <DetailsSection title={_("File system")}>
          <PartitionableMountContent entry={entry} subject={subject} showName={false} />
        </DetailsSection>
        {isCurrentlyPartitioned && (
          <DetailsSection title={_("Current partitions")}>
            <CurrentContentSection entry={entry} subject={subject} fixedDecision="delete" />
          </DetailsSection>
        )}
        {!isCurrentlyPartitioned && (
          <DetailsSection title={_("Current content")}>
            <ExistingContent entry={entry} isDeleted />
          </DetailsSection>
        )}
      </Body>
    );
  }

  const withPartitions = configModel.partitionable.isUsed(config, partitionable.name);
  if (withPartitions) {
    if (isCurrentlyPartitioned) {
      return (
        <Body>
          <Intro>
            {_(
              "Customize how the new system will use this disk, existing partitions can be deleted or reduced to make space for the new system or can be used by it.",
            )}
          </Intro>
          <DetailsSection title={_("Partitions for the new system")}>
            <PartitionableContent entry={entry} subject={subject} />
          </DetailsSection>
          <DetailsSection title={_("Current partitions")}>
            <CurrentContentSection entry={entry} subject={subject} />
          </DetailsSection>
        </Body>
      );
    }

    return (
      <Body>
        <Intro>{basicIntro}</Intro>
        <DetailsSection title={_("Partitions for the new system")}>
          <PartitionableContent entry={entry} subject={subject} />
        </DetailsSection>
        <DetailsSection title={_("Current content")}>
          <ExistingContent entry={entry} isDeleted />
        </DetailsSection>
      </Body>
    );
  }

  // If the workflow reached this point, then no usage is defined yet
  // (not used for booting, for creating partitions neither for mounting/formatting

  if (isCurrentlyPartitioned || entry.device?.filesystem) {
    return (
      <Body>
        <Intro>{basicIntro}</Intro>
        <DetailsSection title={_("Usage")}>
          <PartitionableNoContent entry={entry} subject={subject} />
        </DetailsSection>
      </Body>
    );
  }

  return (
    <Body>
      <Intro>{basicIntro}</Intro>
      <DetailsSection title={_("Usage")}>
        <PartitionableNoContent entry={entry} subject={subject} />
      </DetailsSection>
      <DetailsSection title={_("Current content")}>
        <ExistingContent entry={entry} />
      </DetailsSection>
    </Body>
  );
}
