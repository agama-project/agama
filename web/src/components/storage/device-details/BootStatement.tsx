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
import configModel from "~/model/storage/config-model";
import { useConfigModel } from "~/hooks/model/storage/config-model";
import { isExistingBootPartition } from "~/components/storage/utils";
import { _ } from "~/i18n";
import type { Entry } from "~/components/storage/device-details/entry";

export type BootStatementProps = {
  entry: Entry;
};

/**
 * Says the system boots from this device, which may take new partitions and,
 * if it has one, its existing boot partition. Renders nothing otherwise.
 */
export default function BootStatement({ entry }: BootStatementProps): React.ReactNode {
  const config = useConfigModel();
  const name = entry.config.name;

  if (!config || !name || !configModel.boot.hasDevice(config, name)) return null;

  const potentialReuse = !!entry.device?.partitions?.some((p) => isExistingBootPartition(p));

  return (
    <p>
      {potentialReuse
        ? _(
            "To boot the system, some existing partition may be used if possible and additional new partitions may be created.",
          )
        : _("Additional partitions to boot the system may be created if needed.")}
    </p>
  );
}
