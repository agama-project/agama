/*
 * Copyright (c) [2024] SUSE LLC
 *
 * All Rights Reserved.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of version 2 of the GNU General Public License as published
 * by the Free Software Foundation.
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

import { _ } from "~/i18n";
import { noop } from "~/utils";
import { hasFS } from "~/components/storage/utils";
import { SwitchField } from "~/components/core";

/**
 * @typedef {import ("~/client/storage").ProposalSettings} ProposalSettings
 * @typedef {import ("~/client/storage").Volume} Volume
 */

const LABEL = _("Use Btrfs snapshots for the root file system");
const DESCRIPTION = _("Allows to boot to a previous version of the \
system after configuration changes or software upgrades.");

/**
 * Allows to define snapshots enablement
 * @component
 *
 * @typedef {object} SnapshotsFieldProps
 * @property {Volume} rootVolume
 * @property {(config: object) => void} onChange
 *
 * @param {SnapshotsFieldProps} props
 */
export default function SnapshotsField({
  rootVolume,
  onChange = noop
}) {
  const isChecked = hasFS(rootVolume, "Btrfs") && rootVolume.snapshots;

  const switchState = () => {
    onChange({ active: !isChecked });
  };

  return (
    <SwitchField
      label={LABEL}
      description={DESCRIPTION}
      isChecked={isChecked}
      onClick={switchState}
      textWrapper="span"
    />
  );
}
