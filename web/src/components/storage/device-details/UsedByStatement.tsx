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
import RelatedNames from "~/components/storage/shared/RelatedNames";
import Interpolate from "~/components/core/Interpolate";
import { usersOf } from "~/components/storage/shared/users";
import { useConfigModel } from "~/hooks/model/storage/config-model";
import { useFlattenDevices as useSystemDevices } from "~/hooks/model/system/storage";
import { _ } from "~/i18n";
import type { Entry } from "~/components/storage/device-details/entry";
import type { Partitionable } from "~/model/storage/config-model";

export type UsedByStatementProps = {
  entry: Entry;
};

/**
 * Names the LVM volume groups that may take room from this disk, each a link
 * to its panel. Renders nothing otherwise.
 */
export default function UsedByStatement({ entry }: UsedByStatementProps): React.ReactNode {
  const config = useConfigModel();
  const systemDevices = useSystemDevices();

  if (entry.isVolumeGroup) return null;

  const users = usersOf(config, systemDevices, (entry.config as Partitionable.Device).name);
  if (users.length === 0) return null;

  return (
    <p>
      <Interpolate
        // TRANSLATORS: %s is one or more LVM volume group names, like "system"
        sentence={_("New partitions may be added as LVM physical volumes for %s.")}
      >
        {() => <RelatedNames items={users} />}
      </Interpolate>
    </p>
  );
}
