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
import Link from "~/components/core/Link";
import Interpolate from "~/components/core/Interpolate";
import DetailsItem from "~/components/storage/device-details/DetailsItem";
import { STORAGE as PATHS } from "~/routes/paths";
import configModel from "~/model/storage/config-model";
import { useConfigModel } from "~/hooks/model/storage/config-model";
import { isExistingBootPartition } from "~/components/storage/utils";
import { _ } from "~/i18n";
import type { Entry } from "~/components/storage/device-details/entry";

export type BootStatementProps = {
  entry: Entry;
};

/**
 * That the machine will start from this device, why, and what that costs it.
 *
 * The two answers no other view gives: whether the installer picked the device
 * or the reader did, and which partitions booting takes. How the automatic
 * choice is worked out is a longer story, and the boot options page is where it
 * is already told, so the statement ends with the way there: a reader who has
 * just learned the installer chose for them is the one most likely to want it.
 */
export default function BootStatement({ entry }: BootStatementProps): React.ReactNode {
  const config = useConfigModel();
  const name = entry.config.name;

  if (!config || !name || !configModel.boot.hasDevice(config, name)) return null;

  const potentialReuse = !!entry.device?.partitions?.some((p) => isExistingBootPartition(p));
  const sentence = potentialReuse
    ? configModel.boot.isDefault(config)
      ? // TRANSLATORS: The text in square brackets is a link to the boot setting.
        _(
          "[Automatically chosen] for booting. Some existing partition may be used for that purpose if possible. Additional new ones may be created if needed.",
        )
      : // TRANSLATORS: The text in square brackets is a link to the boot setting.
        _(
          "[Explicitly chosen] for booting. Some existing partition may be used for that purpose if possible. Additional new ones may be created if needed.",
        )
    : configModel.boot.isDefault(config)
      ? // TRANSLATORS: The text in square brackets is a link to the boot setting.
        _(
          "[Automatically chosen] for booting. Additional partitions may be created for that purpose if needed.",
        )
      : // TRANSLATORS: The text in square brackets is a link to the boot setting.
        _(
          "[Explicitly chosen] for booting. Additional partitions may be created for that purpose if needed.",
        );

  return (
    <DetailsItem
      value={
        <Interpolate sentence={sentence}>
          {(text) => (
            <Link to={PATHS.editBootDevice} keepQuery variant="link" isInline>
              {text}
            </Link>
          )}
        </Interpolate>
      }
    />
  );
}
