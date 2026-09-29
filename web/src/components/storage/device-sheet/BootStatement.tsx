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
import Statement from "~/components/storage/device-sheet/Statement";
import { STORAGE as PATHS } from "~/routes/paths";
import configModel from "~/model/storage/config-model";
import { useConfigModel } from "~/hooks/model/storage/config-model";
import { _ } from "~/i18n";
import type { Entry } from "~/components/storage/device-sheet/entry";

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

  return (
    // Maybe the sentence below could provide access to a tooltip expanding the information
    // "Some partitions may be used or created if needed to make the system able to boot."
    <Statement icon="settings_backup_restore" heading={_("Partitions needed for booting.")}>
      <Interpolate
        sentence={
          configModel.boot.isDefault(config)
            ? _("This disk was [automatically chosen] for booting.")
            : _("This disk was [explicitly chosen] for booting.")
        }
      >
        {(text) => (
          <Link to={PATHS.editBootDevice} keepQuery variant="link" isInline>
            {text}
          </Link>
        )}
      </Interpolate>
    </Statement>
  );
}
