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
import { MenuButtonItem } from "~/components/core/MenuButton";
import { useSetSpacePolicy } from "~/hooks/model/storage/config-model";
import { useEntry } from "~/components/storage/device-details/entry";
import { useConfigModel } from "~/hooks/model/storage/config-model";
import { useFlattenDevices as useSystemDevices } from "~/hooks/model/system/storage";
import configModel from "~/model/storage/config-model";
import { _, TranslatedString } from "~/i18n";
import Icon from "~/components/layout/Icon";
import type { DetailsSubject } from "~/components/storage/shared/use-device-details";
import type { ConfigModel } from "~/model/storage/config-model";

const POLICIES: ConfigModel.SpacePolicy[] = ["delete", "resize"];

/** The title of each item. */
function label(policy: ConfigModel.SpacePolicy): TranslatedString {
  return policy === "delete" ? _("Remove all data") : _("Keep the current data");
}

function meaning(policy: ConfigModel.SpacePolicy, isVg: boolean): TranslatedString {
  if (policy === "delete") return _("The space will be available for the new system");

  return isVg
    ? _("Some logical volumes may be reduced if needed")
    : _("Some partitions may be reduced if needed");
}

function disabledDescription(config, systemDevices, entry): TranslatedString | undefined {
  const device = entry.device;

  if (entry.isVolumeGroup) {
    if (!device.logicalVolumes.length) {
      // TRANSLATORS: reason to disable de menu entry "Actions on current content"
      return _("No content detected");
    }

    const group = entry.config;
    if (configModel.volumeGroup.isReusingLogicalVolumes(group)) {
      // TRANSLATORS: reason to disable de menu entry "Actions on current content"
      return _("Already using existing logical volumes");
    }

    if (!configModel.volumeGroup.isAddingLogicalVolumes(group)) {
      // TRANSLATORS: reason to disable de menu entry "Actions on current content"
      return _("No usage defined yet");
    }
  } else {
    const partitionable = entry.config;

    if (partitionable.filesystem?.reuse) {
      // TRANSLATORS: reason to disable de menu entry "Actions on current content"
      return _("The current data will be kept");
    }

    if (
      !device.partitionTable &&
      !device.filesystem &&
      !systemDevices.some((d) => d.volumeGroup?.physicalVolumes.includes(device.sid)) &&
      !systemDevices.some((d) => d.md?.devices.includes(device.sid))
    ) {
      // TRANSLATORS: reason to disable de menu entry "Actions on current content"
      return _("No content detected");
    }

    if (
      !configModel.partitionable.isUsed(config, partitionable.name) &&
      !configModel.boot.hasDevice(config, partitionable.name)
    ) {
      // TRANSLATORS: reason to disable de menu entry "Actions on current content"
      return _("No usage defined yet");
    }

    if (!device.partitionTable || partitionable.filesystem) {
      // TRANSLATORS: reason to disable de menu entry "Actions on current content"
      return _("All disk content will be deleted");
    }

    if (configModel.partitionable.isReusingPartitions(partitionable)) {
      // TRANSLATORS: reason to disable de menu entry "Actions on current content"
      return _("Already using existing partitions");
    }
  }
}

export type SpacePolicyMenuItemProps = {
  subject: DetailsSubject;
};

export default function SpacePolicyMenuItem({ subject }: SpacePolicyMenuItemProps) {
  const config = useConfigModel();
  const systemDevices = useSystemDevices();
  const setSpacePolicy = useSetSpacePolicy();
  const entry = useEntry(subject);
  const isVolumeGroup = entry.isVolumeGroup;

  /* Choosing the current policy changes nothing. */
  const choose = (next: ConfigModel.SpacePolicy) => {
    if (next !== entry.config.spacePolicy)
      setSpacePolicy(subject.collection, subject.index, { type: next });
  };

  const choices = POLICIES.map((value) => (
    <MenuButtonItem
      key={value}
      icon={<Icon size="md" name={value === "delete" ? "delete_sweep" : "compress"} />}
      description={meaning(value, isVolumeGroup)}
      onClick={() => choose(value)}
    >
      {label(value)}
    </MenuButtonItem>
  ));

  const title = _("Actions on current content");
  const disabledDesc = disabledDescription(config, systemDevices, entry);
  const enabledDesc = isVolumeGroup
    ? _("Configure whether to delete or shrink logical volumes")
    : _("Configure whether to delete or shrink partitions");

  return (
    <MenuButtonItem
      key="space-policy"
      icon={<Icon size="md" name="home_storage" />}
      description={disabledDesc || enabledDesc}
      isDisabled={!!disabledDesc}
      flyoutItems={choices}
    >
      {title}
    </MenuButtonItem>
  );
}
