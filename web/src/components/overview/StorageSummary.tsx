/*
 * Copyright (c) [2025-2026] SUSE LLC
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
import { sprintf } from "sprintf-js";
import { isEmpty } from "radashi";
import Summary from "~/components/core/Summary";
import Link from "~/components/core/Link";
import { useProgressTracking } from "~/hooks/use-progress-tracking";
import { useConfigModel } from "~/hooks/model/storage/config-model";
import {
  useFlattenDevices as useSystemFlattenDevices,
  useAvailableDevices,
  useDevices,
} from "~/hooks/model/system/storage";
import {
  useFlattenDevices as useProposalFlattenDevices,
  useActions,
} from "~/hooks/model/proposal/storage";
import DevicesManager from "~/model/storage/devices-manager";
import { useIssues } from "~/hooks/model/issue";
import { deviceLabel } from "~/components/storage/utils";
import { STORAGE } from "~/routes/paths";
import { _, formatList } from "~/i18n";

import type { Storage } from "~/model/system";
import type { ConfigModel } from "~/model/storage/config-model";

const findDriveDevice = (drive: ConfigModel.Drive, devices: Storage.Device[]) =>
  devices.find((d) => d.name === drive.name);

const NoDeviceSummary = () => _("No device selected yet");

const SingleDeviceSummary = ({ target }: { target: ConfigModel.Drive | ConfigModel.MdRaid }) => {
  const devices = useDevices();
  const device = findDriveDevice(target, devices);
  // TRANSLATORS: %s will be replaced by the device name and its size,
  // example: "/dev/sda, 20 GiB"
  const text = _("Use device %s");
  const [textStart, textEnd] = text.split("%s");

  return (
    <div>
      <span>{textStart}</span>
      <b>{device ? deviceLabel(device) : target.name}</b>
      <span>{textEnd}</span>
    </div>
  );
};

const ModelSummary = ({ model }: { model: ConfigModel.Config }): React.ReactNode => {
  const devices = useDevices();
  const drives = model?.drives || [];
  // We are only interested in RAIDs and VGs that are being reused. With the current model,
  // that means all RAIDs and no VGs. Revisit when (a) the model allows to create new RAIDs or
  // (b) the model allows to reuse existing VGs.
  const raids = model?.mdRaids || [];
  const targets = drives.concat(raids);
  const existDevice = (name: string) => devices.some((d) => d.name === name);
  const noTarget = targets.length === 0 || targets.some((d) => !existDevice(d.name));

  if (noTarget) return <NoDeviceSummary />;
  if (targets.length > 1) return _("Use several devices");
  return <SingleDeviceSummary target={targets[0]} />;
};

const Value = () => {
  const availableDevices = useAvailableDevices();
  const model = useConfigModel();
  const issues = useIssues("storage");
  const configIssues = issues.filter((i) => i.class !== "proposal");

  if (!availableDevices.length) return _("There are no disks available for the installation");
  if (configIssues.length) {
    return _("Invalid settings");
  }

  if (!model) return _("Using an advanced storage configuration");

  return <ModelSummary model={model} />;
};

const Description = () => {
  const system = useSystemFlattenDevices();
  const staging = useProposalFlattenDevices();
  const actions = useActions();
  const issues = useIssues("storage");
  const configIssues = issues.filter((i) => i.class !== "proposal");
  const manager = new DevicesManager(system, staging, actions);

  if (configIssues.length) return;
  if (!actions.length) return _("Failed to calculate a storage layout");

  const deleteActions = manager.actions.filter((a) => a.delete && !a.subvol).length;
  if (!deleteActions) return _("No data loss is expected");

  const systems = manager.deletedSystems();
  if (systems.length) {
    return sprintf(
      // TRANSLATORS: %s will be replaced by a formatted list of affected systems
      // like "Windows and openSUSE Tumbleweed".
      _("Potential data loss affecting at least %s"),
      formatList(systems),
    );
  }

  return _("Potential data loss");
};

/**
 * Displays a summary of the current storage configuration and proposed changes.
 *
 * It provides an overview of the storage setup, including:
 *   - Selected target devices (drives, RAIDs, volume groups)
 *   - Validation status of the storage configuration
 *   - Data loss warnings for affected systems
 *   - Loading state during storage proposal calculations
 *
 * The title is a clickable link that navigates to the storage configuration page.
 *
 * Based on the storage settings, it will output
 *
 * **Value (main content):**
 *  - "No device selected yet" when no valid target devices are configured
 *  - "Use device [name]" for single device configurations
 *  - "Use several devices" for multi-device configurations
 *  - "There are no disks available for the installation" when no disks are detected
 *  - "Invalid settings" warning when configuration issues exist
 *  - "Using an advanced storage configuration" when model is unavailable
 *
 * **Description (secondary content):**
 *  - "No data loss is expected" when no delete actions are proposed
 *  - "Potential data loss" when delete actions exist
 *  - "Potential data loss affecting at least [systems]" when existing systems will be affected
 *  - "Failed to calculate a storage layout" when no actions are available
 *  - Hidden when configuration issues exist
 */
export default function StorageSummary() {
  const { loading } = useProgressTracking("storage");
  // FIXME: Refactor for avoid duplicating these checks about issues and actions
  // TODO: extend tests for covering the hasIssues status
  const actions = useActions();
  const issues = useIssues("storage");
  const configIssues = issues.filter((i) => i.class !== "proposal");

  return (
    <Summary
      hasIssues={!isEmpty(configIssues) || isEmpty(actions)}
      icon="hard_drive"
      title={
        <Link to={STORAGE.root} variant="link" isInline>
          {_("Storage")}
        </Link>
      }
      value={<Value />}
      description={<Description />}
      isLoading={loading}
    />
  );
}
