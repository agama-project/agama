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
import { Flex, FlexItem } from "@patternfly/react-core";
import Interpolate from "~/components/core/Interpolate";
import Link from "~/components/core/Link";
import LinkedNameList from "~/components/storage/shared/LinkedNameList";
import { baseName } from "~/components/storage/utils";
import { STORAGE as PATHS } from "~/routes/paths";
import { generateEncodedPath } from "~/utils";
import configModel from "~/model/storage/config-model";
import { useConfigModel } from "~/hooks/model/storage/config-model";
import { _ } from "~/i18n";
import type { ConfigModel } from "~/model/storage/config-model";
import type { Entry } from "~/components/storage/device-details/entry";
import type { DetailsSubject } from "~/components/storage/shared/use-device-details";
import type { Related } from "~/components/storage/shared/users";

export type PropertiesSectionProps = {
  entry: Entry;
  /** Where the volume group is in the configuration. */
  subject: DetailsSubject;
};

/**
 * The properties of a volume group the installation creates: the devices its
 * physical volumes come from, each a link to its panel, and a link to the form
 * changing them.
 *
 * @todo Revisit the "Properties" heading once a RAID uses this section too:
 * "Settings", "Definition" and "Setup" were also considered.
 */
export default function PropertiesSection({ entry, subject }: PropertiesSectionProps) {
  const config = useConfigModel();
  const group = entry.config as ConfigModel.VolumeGroup;

  const sources: Related[] = (group.targetDevices || []).map((name) => ({
    name: baseName(name),
    subject: configModel.partitionable.findLocation(config, name) || undefined,
  }));

  return (
    <Flex direction={{ default: "column" }} gap={{ default: "gapMd" }}>
      <FlexItem component="p">
        {sources.length ? (
          <Interpolate
            // TRANSLATORS: %s is a list of disks, such as "vdb, vdc and vdd"
            sentence={_("LVM physical volumes will be added as partitions on %s.")}
          >
            {() => <LinkedNameList items={sources} />}
          </Interpolate>
        ) : (
          _("No device chosen yet for its physical volumes.")
        )}
      </FlexItem>
      <FlexItem>
        <Link
          to={generateEncodedPath(PATHS.volumeGroup.edit, { id: String(subject.index) })}
          keepQuery
          variant="link"
          isInline
        >
          {_("Edit the volume group")}
        </Link>
      </FlexItem>
    </Flex>
  );
}
