/*
 * Copyright (c) [2025] SUSE LLC
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

import Details from "~/components/core/Details";
import Link from "~/components/core/Link";

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
import { useProgressTracking } from "~/hooks/use-progress-tracking";
import { HelperText, HelperTextItem } from "@patternfly/react-core";

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

const LinkContent = () => {
  const availableDevices = useAvailableDevices();
  const model = useConfigModel();
  const issues = useIssues("storage");
  const configIssues = issues.filter((i) => i.class !== "proposal");

  if (!availableDevices.length) return _("There are no disks available for the installation");
  if (configIssues.length) {
    return (
      <HelperText>
        <HelperTextItem variant="warning">{_("Invalid settings")}</HelperTextItem>
      </HelperText>
    );
  }

  if (!model) return _("Using an advanced storage configuration");

  return <ModelSummary model={model} />;
};

const DescriptionContent = () => {
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
 * In the near future, this component may receive one or more props (to be
 * defined) to display additional or alternative information. This will be
 * especially useful for reusing the component in the interface where users are
 * asked to confirm that they want to proceed with the installation.
 *
 * DISCLAIMER: Naming still has significant room for improvement, starting with
 * the component name itself. These changes should be addressed in a final step,
 * once all "overview/confirmation" items are clearly defined.
 */
export default function StorageDetailsItem() {
  const { loading } = useProgressTracking("storage");

  return (
    <Details.StackItem
      label={
        <Link to={STORAGE.root} variant="link" isInline>
          {_("Storage")}
        </Link>
      }
      content={<LinkContent />}
      description={<DescriptionContent />}
      isLoading={loading}
    />
  );
}
