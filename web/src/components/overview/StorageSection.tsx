/*
 * Copyright (c) [2022-2025] SUSE LLC
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
import { Content } from "@patternfly/react-core";
import { deviceLabel } from "~/components/storage/utils";
import { useAvailableDevices, useDevices, useIssues } from "~/hooks/model/system/storage";
import { useStorageModel } from "~/hooks/model/storage";
import { _ } from "~/i18n";
import type { storage } from "~/model/system";
import type { configModel } from "~/model/storage/config-model";

const findDriveDevice = (drive: configModel.Drive, devices: storage.Device[]) =>
  devices.find((d) => d.name === drive.name);

const NoDeviceSummary = () => _("No device selected yet");

const SingleDiskSummary = ({ drive }: { drive: configModel.Drive }) => {
  const devices = useDevices();
  const device = findDriveDevice(drive, devices);
  const options = {
    // TRANSLATORS: %s will be replaced by the device name and its size,
    // example: "/dev/sda, 20 GiB"
    resize: _("Install using device %s shrinking existing partitions as needed."),
    // TRANSLATORS: %s will be replaced by the device name and its size,
    // example: "/dev/sda, 20 GiB"
    keep: _("Install using device %s without modifying existing partitions."),
    // TRANSLATORS: %s will be replaced by the device name and its size,
    // example: "/dev/sda, 20 GiB"
    delete: _("Install using device %s and deleting all its content."),
    // TRANSLATORS: %s will be replaced by the device name and its size,
    // example: "/dev/sda, 20 GiB"
    custom: _("Install using device %s with a custom strategy to find the needed space."),
  };

  const [textStart, textEnd] = options[drive.spacePolicy].split("%s");

  return (
    <>
      <span>{textStart}</span>
      <b>{device ? deviceLabel(device) : drive.name}</b>
      <span>{textEnd}</span>
    </>
  );
};

const MultipleDisksSummary = ({ drives }: { drives: configModel.Drive[] }): string => {
  const options = {
    resize: _("Install using several devices shrinking existing partitions as needed."),
    keep: _("Install using several devices without modifying existing partitions."),
    delete: _("Install using several devices and deleting all its content."),
    custom: _("Install using several devices with a custom strategy to find the needed space."),
  };

  if (drives.find((d) => d.spacePolicy !== drives[0].spacePolicy)) {
    return options.custom;
  }

  return options[drives[0].spacePolicy];
};

const ModelSummary = ({ model }: { model: configModel.Config }): React.ReactNode => {
  const devices = useDevices();
  const drives = model?.drives || [];
  const existDevice = (name: string) => devices.some((d) => d.name === name);
  const noDrive = drives.length === 0 || drives.some((d) => !existDevice(d.name));

  if (noDrive) return <NoDeviceSummary />;
  if (drives.length > 1) return <MultipleDisksSummary drives={drives} />;
  return <SingleDiskSummary drive={drives[0]} />;
};

const NoModelSummary = (): React.ReactNode => {
  const availableDevices = useAvailableDevices();
  const systemErrors = useIssues();
  const hasDisks = !!availableDevices.length;
  const hasResult = !systemErrors.length;

  if (!hasResult && !hasDisks) return _("There are no disks available for the installation.");
  return _("Install using an advanced configuration.");
};

/**
 * Text explaining the storage proposal
 */
export default function StorageSection() {
  const configModel = useStorageModel();

  return (
    <Content>
      <Content component="h3">{_("Storage")}</Content>
      <Content>
        {configModel && <ModelSummary model={configModel} />}
        {!configModel && <NoModelSummary />}
      </Content>
    </Content>
  );
}
