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
import { sprintf } from "sprintf-js";
import { useAnnounce } from "~/context/announcer";
import { withForm } from "~/hooks/form";
import { useDevice } from "~/hooks/model/system/storage";
import configModel from "~/model/storage/config-model";
import { _ } from "~/i18n";

import type { TranslatedString } from "~/i18n";
import { defaultOptions } from "./fields";
import { holderOutcome, holderSetup, holderTitle } from "./mount-point-holder";

import type { MountPathHolder } from "~/model/storage/config-model";

type Holder = Parameters<typeof holderSetup>[0];

/** How the holder is set up now, reading an existing partition from the machine. */
function HolderSetup({ holder }: { holder: Holder }) {
  const device = useDevice(holder.kind === "existingPartition" ? holder.deviceName : "");
  const partition =
    holder.kind === "existingPartition"
      ? device?.partitions?.find((p) => p.name === holder.partitionName)
      : undefined;

  return <p>{holderSetup(holder, partition)}</p>;
}

/** Says the notice once, when it appears, since it shows up behind the focus. */
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
  holder: MountPathHolder;
};

/**
 * Notice for a mount point already assigned elsewhere in the configuration.
 *
 * It names what holds the mount point. When that is a partition or a logical
 * volume, it also tells how it is set up now and offers to assign the mount
 * point to this partition instead. Like any other field, the choice applies
 * only when the form is accepted, and only for the mount point it was made
 * for. A whole disk or RAID cannot give its mount point up, so the notice
 * only asks for another one.
 *
 * It is a user aid, not a validation error: the mount point field keeps its
 * own error, shown on submit as usual.
 */
const MountPointAssignment = withForm({
  ...defaultOptions,
  props: {} as MountPointAssignmentProps,
  render: function Render({ form, mountPoint, holder }) {
    const title = holderTitle(mountPoint, holder);
    const canAssign = configModel.canReleaseMountPath(holder);

    return (
      <Flex>
        <Alert isInline variant="info" component="p" title={title}>
          <Announce text={title} />
          {canAssign ? (
            <>
              <HolderSetup holder={holder} />
              <form.AppField name="reassignedMountPoint">
                {(field) => (
                  <Checkbox
                    id={field.name}
                    label={sprintf(
                      // TRANSLATORS: option in the notice saying a mount point
                      // is already assigned elsewhere. %s is the mount point
                      // (e.g. "/home").
                      _("Assign %s to this partition instead"),
                      mountPoint,
                    )}
                    description={holderOutcome(mountPoint, holder)}
                    isChecked={field.state.value === mountPoint}
                    onChange={(_event, checked) => field.handleChange(checked ? mountPoint : "")}
                  />
                )}
              </form.AppField>
            </>
          ) : (
            <p>
              {
                // TRANSLATORS: in the notice saying a mount point is already
                // assigned to a whole disk or RAID.
                _("Choose another mount point.")
              }
            </p>
          )}
        </Alert>
      </Flex>
    );
  },
});

export default MountPointAssignment;
