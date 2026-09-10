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
import { DescriptionList, Flex, FlexItem, Stack, StackItem } from "@patternfly/react-core";
import Link from "~/components/core/Link";
import SettingValue from "~/components/core/SettingValue";
import Text from "~/components/core/Text";
import Icon from "~/components/layout/Icon";
import SheetOpener from "~/components/storage/shared/SheetOpener";
import { baseName } from "~/components/storage/utils";
import { STORAGE as PATHS } from "~/routes/paths";
import { generateEncodedPath } from "~/utils";
import configModel from "~/model/storage/config-model";
import { useConfigModel } from "~/hooks/model/storage/config-model";
import { _ } from "~/i18n";
import type { ConfigModel } from "~/model/storage/config-model";
import type { Entry } from "~/components/storage/device-sheet/entry";

/**
 * One of the entries this one is built from, and the way to it.
 *
 * Naming something the reader can go to without offering the way there leaves
 * them to find it by hand in a list they have to close this panel to see.
 * A device the configuration does not hold is named and no more, since there is
 * no entry of its own to open.
 */
function Member({ name }: { name: string }) {
  const config = useConfigModel();
  const location = configModel.partitionable.findLocation(config, name);

  if (!location) return <>{baseName(name)}</>;

  return (
    <SheetOpener subject={{ collection: location.collection, index: location.index }}>
      {baseName(name)}
    </SheetOpener>
  );
}

export type PropertiesSectionProps = {
  entry: Entry;
};

/**
 * What an entry is made of, where the entry is defined rather than found.
 *
 * A volume group and a software RAID are the two entries of a plan that are not
 * a piece of hardware. What defines them is a list of other entries plus a few
 * decisions about how to use them, and that is neither what they will hold nor
 * what is on them today: being not yet true does not make it content.
 *
 * A disk has none of this. It is the hardware, so there is nothing that defines
 * it to show.
 *
 * What belongs here is not settled beyond that. Today it holds what the entry
 * is built on, how much of those devices it takes, and the way to the form that
 * changes both.
 */
export default function PropertiesSection({ entry }: PropertiesSectionProps): React.ReactNode {
  const group = entry.config as ConfigModel.VolumeGroup;
  const targets = group.targetDevices || [];

  const spread = () => {
    if (!group.targetDevicesPolicy) return undefined;

    return group.targetDevicesPolicy === "useNeeded"
      ? // TRANSLATORS: how much of the disks under an LVM volume group it takes:
        // room for what it holds and no more.
        _("Only what its volumes need")
      : // TRANSLATORS: how much of the disks under an LVM volume group it takes:
        // everything they have.
        _("All the space available on those devices");
  };

  return (
    <Stack hasGutter>
      <StackItem>
        <Text textStyle={["fontSizeSm", "textColorSubtle"]}>
          {/* TRANSLATORS: says what this view of an entry holds: the other
              entries it is built from, and how it uses them. */}
          {_("What it is made of")}
        </Text>
      </StackItem>
      <StackItem>
        <DescriptionList isCompact isHorizontal isFluid>
          <SettingValue
            icon="network_node"
            // TRANSLATORS: names the entries an LVM volume group is built on.
            term={_("Uses")}
            value={
              targets.length ? (
                <Flex gap={{ default: "gapSm" }}>
                  {targets.map((name) => (
                    <FlexItem key={name}>
                      <Member name={name} />
                    </FlexItem>
                  ))}
                </Flex>
              ) : (
                // TRANSLATORS: said of an LVM volume group with no disk chosen
                // for it yet.
                _("No device chosen yet")
              )
            }
          />
          {spread() && (
            <SettingValue
              icon="compress"
              // TRANSLATORS: names how much of the disks under an LVM volume
              // group the group takes.
              term={_("Space taken")}
              value={spread()}
            />
          )}
        </DescriptionList>
      </StackItem>
      <StackItem>
        {/* At the foot, after what it changes: the panel says what the entry
            is, and the form is where it becomes something else. */}
        <Flex>
          <FlexItem>
            <Link
              to={generateEncodedPath(PATHS.volumeGroup.edit, { id: group.vgName })}
              keepQuery
              variant="secondary"
              icon={<Icon name="edit_square" size="sm" />}
            >
              {/* TRANSLATORS: offered inside an LVM volume group's panel: change
                  which disks it is built on and how it uses them. */}
              {_("Edit the volume group")}
            </Link>
          </FlexItem>
        </Flex>
      </StackItem>
    </Stack>
  );
}
