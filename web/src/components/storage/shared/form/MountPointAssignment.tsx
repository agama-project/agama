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
import Text from "~/components/core/Text";
import { useAnnounce } from "~/context/announcer";
import { withForm } from "~/hooks/form";
import { useDevice } from "~/hooks/model/system/storage";
import { sharedDefaultOptions } from "./fields";
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

type MountPointAssignmentProps = {
  /** The mount point the user finished entering. */
  mountPoint: string;
  /** What that mount point is already assigned to. */
  holder: ReleasableHolder;
  /**
   * The option to discard the holder's settings and assign the mount point to
   * what the form configures, as one whole sentence that names it.
   */
  label: string;
};

/**
 * Notice for a mount point already assigned elsewhere in the configuration,
 * to a partition or a logical volume.
 *
 * It names what holds the mount point, tells how that is set up now, and
 * offers to discard those settings and assign the mount point to what the
 * form configures. Like any other field, the choice applies only when the form
 * is accepted, and only for the mount point it was made for.
 *
 * It is a user aid, not a validation error: the mount point field keeps its
 * own error, shown on submit as usual.
 */
const MountPointAssignment = withForm({
  ...sharedDefaultOptions,
  props: {} as MountPointAssignmentProps,
  render: function Render({ form, mountPoint, holder, label }) {
    const title = holderTitle(mountPoint, holder);

    return (
      <Flex>
        <Alert isInline variant="info" component="p" title={title}>
          <Announce text={title} />
          <Flex direction={{ default: "column" }} gap={{ default: "gapMd" }}>
            <HolderSettings holder={holder} />
            <form.AppField name="reassignedMountPoint">
              {/* Not CheckboxField: the field holds the mount point the
                  choice is made for, not a yes or no. */}
              {(field) => (
                <Checkbox
                  id={field.name}
                  label={label}
                  isChecked={field.state.value === mountPoint}
                  onChange={(_event, checked) => field.handleChange(checked ? mountPoint : "")}
                />
              )}
            </form.AppField>
          </Flex>
        </Alert>
      </Flex>
    );
  },
});

export default MountPointAssignment;
