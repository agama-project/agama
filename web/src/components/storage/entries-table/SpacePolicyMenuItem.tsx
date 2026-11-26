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
import { _, TranslatedString } from "~/i18n";
import Icon from "~/components/layout/Icon";
import type { ConfigModel, DeviceCollection } from "~/model/storage/config-model";

/** Safest first, so the one that loses data comes last. */
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

export type SpacePolicyMenuItemProps = {
  collection: DeviceCollection;
  index: number;
  /** What the device allows its partitions today. */
  policy: ConfigModel.SpacePolicy;
};

export default function SpacePolicyMenuItem({
  collection,
  index,
  policy,
}: SpacePolicyMenuItemProps) {
  const setSpacePolicy = useSetSpacePolicy();
  const isVolumeGroup = collection === "volumeGroups";

  /* Choosing the current policy changes nothing. */
  const choose = (next: ConfigModel.SpacePolicy) => {
    if (next !== policy) setSpacePolicy(collection, index, { type: next });
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
  const description = isVolumeGroup
    ? _("Configure whether to delete or shrink logical volumes")
    : _("Configure whether to delete or shrink partitions");

  return (
    <MenuButtonItem
      key="space-policy"
      icon={<Icon size="md" name="home_storage" />}
      description={description}
      flyoutItems={choices}
    >
      {title}
    </MenuButtonItem>
  );
}
