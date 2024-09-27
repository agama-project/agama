/*
 * Copyright (c) [2024] SUSE LLC
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

// @ts-check

import React from "react";
import { Split, Switch } from "@patternfly/react-core";
import { _ } from "~/i18n";
import { hasFS } from "~/components/storage/utils";
import textStyles from "@patternfly/react-styles/css/utilities/Text/text";
import { Volume } from "~/types/storage";

export type SnapshotsFieldProps = {
  rootVolume: Volume;
  onChange?: (config: SnapshotsConfig) => void;
};

export type SnapshotsConfig = {
  active: boolean;
};

/**
 * Allows to define snapshots enablement
 * @component
 */
export default function SnapshotsField({ rootVolume, onChange }: SnapshotsFieldProps) {
  const isChecked = hasFS(rootVolume, "Btrfs") && rootVolume.snapshots;

  const label = _("Use Btrfs snapshots for the root file system");

  const switchState = () => {
    if (onChange) onChange({ active: !isChecked });
  };

  return (
    <Split hasGutter>
      <Switch
        id="snapshots"
        aria-label={label}
        isChecked={isChecked}
        onChange={switchState}
        hasCheckIcon
      />
      <div>
        <div>{label}</div>
        <div className={textStyles.color_200}>
          {_(
            "Allows to boot to a previous version of the \
system after configuration changes or software upgrades.",
          )}
        </div>
      </div>
    </Split>
  );
}
