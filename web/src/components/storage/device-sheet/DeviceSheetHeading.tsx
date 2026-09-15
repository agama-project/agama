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
import { Label } from "@patternfly/react-core";
import textStyles from "@patternfly/react-styles/css/utilities/Text/text";
import Text from "~/components/core/Text";
import { deviceSize } from "~/components/storage/utils";
import { typeDescription } from "~/components/storage/utils/device";
import configModel from "~/model/storage/config-model";
import { useConfigModel } from "~/hooks/model/storage/config-model";
import { _ } from "~/i18n";
import type { Entry } from "~/components/storage/device-sheet/entry";

export type DeviceSheetHeadingProps = {
  entry: Entry;
};

/**
 * Which entry the sheet is about, said the way its row says it.
 *
 * The same name and the same facts the list carries, so the row a reader
 * clicked and the panel that opens are visibly the same thing. What the entry
 * is tied to points away from it rather than describing it, so that reads in
 * the body instead.
 *
 * A volume group has no hardware to describe, so it carries only what kind of
 * thing it is. Not its size: that follows from the disks under it, and a group
 * being defined has none yet, so a heading that gave it would say a different
 * number of things about the same group depending on when it was opened.
 */
export default function DeviceSheetHeading({ entry }: DeviceSheetHeadingProps): React.ReactNode {
  const config = useConfigModel();
  const { device, name, isVolumeGroup } = entry;

  const facts = isVolumeGroup
    ? [
        /* Said rather than read off the machine: a group being defined is not
           there yet, and a heading that is only a name leaves the reader to
           remember which list they opened it from. */
        // TRANSLATORS: what kind of entry of the installation this is.
        _("LVM volume group"),
      ]
    : [
        device?.block?.size && deviceSize(device.block.size),
        device && typeDescription(device),
        device?.partitionTable?.type?.toUpperCase(),
      ].filter(Boolean);

  const boots = !isVolumeGroup && configModel.boot.hasDevice(config, entry.config.name);

  return (
    <>
      <Text isBold>{name}</Text>
      {facts.length > 0 && <span className="agm-sheet__facts"> {facts.join("  ·  ")}</span>}
      {/* The same words the list marks it with, so one reader meets one
          vocabulary whichever they arrive at first. */}
      {boots && (
        <>
          {" "}
          {/* Smaller than the name it stands beside. A mark set at the same
              size as the heading reads as a second heading, and this one is a
              note about the device rather than part of what it is called. */}
          <Label isCompact className={textStyles.fontSizeXs}>
            {/* TRANSLATORS: marks the device the machine will start from. */}
            {_("Boot device")}
          </Label>
        </>
      )}
    </>
  );
}
