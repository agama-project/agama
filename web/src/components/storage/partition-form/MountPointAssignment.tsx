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

import React, { useEffect } from "react";
import { Alert, Checkbox, Flex } from "@patternfly/react-core";
import { sift } from "radashi";
import { sprintf } from "sprintf-js";
import Text from "~/components/core/Text";
import { baseName } from "~/components/storage/utils";
import { useAnnounce } from "~/context/announcer";
import { withForm } from "~/hooks/form";
import { useDevice } from "~/hooks/model/system/storage";
import { _ } from "~/i18n";
import { defaultOptions, isReusingPartition } from "./fields";
import { holderBasics, holderExtras, holderTitle } from "./mount-point-holder";

import type { TranslatedString } from "~/i18n";
import type { ReleasableHolder } from "./mount-point-holder";

/**
 * How the holder is set up now, in small dimmed lines: file system and size
 * first, then any other settings it has. Reads an existing partition from the
 * machine.
 */
function HolderSettings({ holder }: { holder: ReleasableHolder }) {
  const device = useDevice(holder.kind === "existingPartition" ? holder.deviceName : "");
  const partition =
    holder.kind === "existingPartition"
      ? device?.partitions?.find((p) => p.name === holder.partitionName)
      : undefined;
  const lines = sift([holderBasics(holder, partition), holderExtras(holder, partition)]);

  return (
    <div>
      {lines.map((line) => (
        <p key={line}>
          <Text textStyle={["fontSizeXs", "fontFamilyMonospace", "textColorSubtle"]}>{line}</Text>
        </p>
      ))}
    </div>
  );
}

/**
 * Says the notice once when it appears, so screen reader users learn about it
 * without reading on.
 */
function Announce({ text }: { text: TranslatedString }) {
  const announce = useAnnounce();
  useEffect(() => {
    announce(text);
  }, [announce, text]);
  return null;
}

/**
 * Offers to discard the holder's settings and assign the mount point to the
 * partition the form configures, named as chosen in the form.
 *
 * @param partitionName - The chosen existing partition, or an empty string for
 *   a new one.
 */
function assignLabel(mountPoint: string, partitionName: string) {
  return isReusingPartition(partitionName)
    ? sprintf(
        // TRANSLATORS: %1$s is a mount point, %2$s a partition (e.g. "sda3").
        _("Discard the current settings and assign %1$s to %2$s"),
        mountPoint,
        baseName(partitionName),
      )
    : sprintf(
        // TRANSLATORS: %s is a mount point. "this" tells the partition being
        // configured apart from the one the mount point is assigned to now.
        _("Discard the current settings and assign %s to this new partition"),
        mountPoint,
      );
}

type MountPointAssignmentProps = {
  /** The mount point the user finished entering. */
  mountPoint: string;
  /** What that mount point is already assigned to. */
  holder: ReleasableHolder;
};

/**
 * Notice for a mount point already assigned elsewhere in the configuration,
 * to a partition or a logical volume.
 *
 * It names what holds the mount point, tells how that is set up now, and
 * offers to discard those settings and assign the mount point to the chosen
 * partition. Like any other field, the choice applies only when the form is
 * accepted, and only for the mount point it was made for.
 *
 * It is a user aid, not a validation error: the mount point field keeps its
 * own error, shown on submit as usual.
 */
const MountPointAssignment = withForm({
  ...defaultOptions,
  props: {} as MountPointAssignmentProps,
  render: function Render({ form, mountPoint, holder }) {
    const title = holderTitle(mountPoint, holder);

    return (
      <Flex>
        <Alert isInline variant="info" component="p" title={title}>
          <Announce text={title} />
          <Flex direction={{ default: "column" }} gap={{ default: "gapMd" }}>
            <HolderSettings holder={holder} />
            <form.Subscribe selector={(s) => s.values.name}>
              {(partitionName) => (
                <form.AppField name="reassignedMountPoint">
                  {/* Not CheckboxField: the field holds the mount point
                        the choice is made for, not a yes or no. */}
                  {(field) => (
                    <Checkbox
                      id={field.name}
                      label={assignLabel(mountPoint, partitionName)}
                      isChecked={field.state.value === mountPoint}
                      onChange={(_event, checked) => field.handleChange(checked ? mountPoint : "")}
                    />
                  )}
                </form.AppField>
              )}
            </form.Subscribe>
          </Flex>
        </Alert>
      </Flex>
    );
  },
});

export default MountPointAssignment;
