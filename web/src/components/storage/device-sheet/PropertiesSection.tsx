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
import Icon from "~/components/layout/Icon";
import RelatedNames from "~/components/storage/shared/RelatedNames";
import { baseName } from "~/components/storage/utils";
import { STORAGE as PATHS } from "~/routes/paths";
import { generateEncodedPath } from "~/utils";
import configModel from "~/model/storage/config-model";
import { useConfigModel } from "~/hooks/model/storage/config-model";
import { _ } from "~/i18n";
import type { ConfigModel } from "~/model/storage/config-model";
import type { Entry } from "~/components/storage/device-sheet/entry";
import type { SheetEntry } from "~/components/storage/shared/use-sheet";
import type { Related } from "~/components/storage/shared/users";

export type PropertiesSectionProps = {
  entry: Entry;
  /** Where the entry is written, which is how its edit form is addressed. */
  subject: SheetEntry;
};

/**
 * What defines a volume group the installation creates, and the way to change
 * it.
 *
 * A volume group being created is not a piece of hardware: it is defined by
 * the devices it takes its room from and a few decisions about how to use
 * them. That is neither what it holds today, since it holds nothing yet, nor
 * what the installation creates in it, so it gets a section of its own.
 *
 * It says where the physical volumes come from in one sentence, with each
 * device a way to its own panel, and the link to the form that changes it
 * comes after. Only what that form can change is said here: the group's name
 * is already in the panel's heading and its row, and other settings the form
 * does not offer would be a summary the reader cannot act on.
 *
 * @todo The section's heading reads "Properties". Other names considered, to
 * revisit once the same section serves a RAID too: "Settings", "Definition",
 * "Setup".
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
            // TRANSLATORS: says where an LVM volume group being created gets its
            // physical volumes: partitions created on these disks. %s is a
            // list of disks, such as "vdb, vdc and vdd", each a link to its
            // panel.
            sentence={_("Physical volumes on %s.")}
          >
            {() => <RelatedNames items={sources} />}
          </Interpolate>
        ) : (
          // TRANSLATORS: said of an LVM volume group with no disk chosen for it
          // yet.
          _("No device chosen yet for its physical volumes.")
        )}
      </FlexItem>
      <FlexItem>
        <Link
          to={generateEncodedPath(PATHS.volumeGroup.edit, { id: String(subject.index) })}
          keepQuery
          variant="secondary"
          size="sm"
        >
          <Flex alignItems={{ default: "alignItemsCenter" }} gap={{ default: "gapSm" }}>
            <Icon name="edit_square" />{" "}
            {
              // TRANSLATORS: offered inside an LVM volume group's panel: change
              // which disks it is built on and how it uses them.
              _("Edit the volume group")
            }
          </Flex>
        </Link>
      </FlexItem>
    </Flex>
  );
}
