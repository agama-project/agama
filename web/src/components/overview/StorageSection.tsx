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
import { Em } from "~/components/core";
import { _ } from "~/i18n";
import { useDevices, useConfigModel } from "~/queries/storage";
import * as ConfigModel from "~/api/storage/types/config-model";

const SectionContent = ({ children }) => (
  <>
    <Content component="h3">{_("Storage")}</Content>
    {children}
  </>
);

/**
 * Text explaining the storage proposal
 *
 * TODO: The current implementation assumes there are only drives and no other kind of devices like
 * LVM volume groups or MD raids. Support for more cases (like LVM installation) will be added as
 * the rest of the interface is also adapted.
 */
export default function StorageSection() {
  const configModel = useConfigModel();
  const devices = useDevices("system", { suspense: true });
  const drives = configModel?.drives || [];

  const label = (drive) => {
    const device = devices.find((d) => d.name === drive.name);
    return device ? deviceLabel(device) : drive.name;
  };

  const msgSingleDisk = (drive: ConfigModel.Drive): string => {
    switch (drive.spacePolicy) {
      case "resize":
        // TRANSLATORS: %s will be replaced by the device name and its size,
        // example: "/dev/sda, 20 GiB"
        return _("Install using device %s shrinking existing partitions as needed.");
      case "keep":
        // TRANSLATORS: %s will be replaced by the device name and its size,
        // example: "/dev/sda, 20 GiB"
        return _("Install using device %s without modifying existing partitions.");
      case "delete":
        // TRANSLATORS: %s will be replaced by the device name and its size,
        // example: "/dev/sda, 20 GiB"
        return _("Install using device %s and deleting all its content.");
    }

    // TRANSLATORS: %s will be replaced by the device name and its size,
    // example: "/dev/sda, 20 GiB"
    return _("Install using device %s with a custom strategy to find the needed space.");
  };

  const msgMultipleDisks = (drives: ConfigModel.Drive[]): string => {
    if (drives.every((d) => d.spacePolicy === drives[0].spacePolicy)) {
      switch (drives[0].spacePolicy) {
        case "resize":
          return _("Install using several devices shrinking existing partitions as needed.");
        case "keep":
          return _("Install using several devices without modifying existing partitions.");
        case "delete":
          return _("Install using several devices and deleting all its content.");
      }
    }

    return _("Install using several devices with a custom strategy to find the needed space.");
  };

  const existDevice = (name) => devices.some((d) => d.name === name);
  const noDrive = drives.length === 0 || drives.some((d) => !existDevice(d.name));

  if (noDrive)
    return (
      <SectionContent>
        <Content>{_("No device selected yet")}</Content>
      </SectionContent>
    );

  if (drives.length > 1) {
    return (
      <SectionContent>
        <span>{msgMultipleDisks(drives)}</span>
      </SectionContent>
    );
  }

  const [msg1, msg2] = msgSingleDisk(drives[0]).split("%s");

  return (
    <SectionContent>
      <Content>
        <span>{msg1}</span>
        <Em>{label(drives[0])}</Em>
        <span>{msg2}</span>
      </Content>
    </SectionContent>
  );
}
