/*
 * Copyright (c) [2024-2025] SUSE LLC
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
import { _ } from "~/i18n";
import { apiModel } from "~/api/storage/types";
import { StorageDevice } from "~/types/storage";
import { useDrive as legacyUseDrive } from "~/queries/storage/config-model";
import { useDrive } from "~/hooks/storage/drive";
import * as driveUtils from "~/components/storage/utils/drive";
import DriveDeviceMenu from "~/components/storage/DriveDeviceMenu";
import DeviceHeader from "~/components/storage/DeviceHeader";
import PartitionsMenu from "~/components/storage/PartitionsMenu";
import SpacePolicyMenu from "~/components/storage/SpacePolicyMenu";
import { Card, CardBody, CardHeader, CardTitle, Flex } from "@patternfly/react-core";

import spacingStyles from "@patternfly/react-styles/css/utilities/Spacing/spacing";

export type DriveEditorProps = { drive: apiModel.Drive; driveDevice: StorageDevice };

const DriveHeader = ({ drive, driveDevice }: DriveEditorProps) => {
  const { isBoot, hasPv } = legacyUseDrive(drive.name);

  const text = (drive: apiModel.Drive): string => {
    if (driveUtils.hasRoot(drive)) {
      if (hasPv) {
        if (isBoot) {
          // TRANSLATORS: %s will be replaced by the device name and its size - "/dev/sda, 20 GiB"
          return _("Use %s to install, host LVM and boot");
        }
        // TRANSLATORS: %s will be replaced by the device name and its size - "/dev/sda, 20 GiB"
        return _("Use %s to install and host LVM");
      }

      if (isBoot) {
        // TRANSLATORS: %s will be replaced by the device name and its size - "/dev/sda, 20 GiB"
        return _("Use %s to install and boot");
      }
      // TRANSLATORS: %s will be replaced by the device name and its size - "/dev/sda, 20 GiB"
      return _("Use %s to install");
    }

    if (driveUtils.hasFilesystem(drive)) {
      if (hasPv) {
        if (isBoot) {
          // TRANSLATORS: %s will be replaced by the device name and its size - "/dev/sda, 20 GiB"
          return _("Use %s for LVM, additional partitions and booting");
        }
        // TRANSLATORS: %s will be replaced by the device name and its size - "/dev/sda, 20 GiB"
        return _("Use %s for LVM and additional partitions");
      }

      if (isBoot) {
        // TRANSLATORS: %s will be replaced by the device name and its size - "/dev/sda, 20 GiB"
        return _("Use %s for additional partitions and booting");
      }
      // TRANSLATORS: %s will be replaced by the device name and its size - "/dev/sda, 20 GiB"
      return _("Use %s for additional partitions");
    }

    if (hasPv) {
      if (isBoot) {
        // TRANSLATORS: %s will be replaced by the device name and its size - "/dev/sda, 20 GiB"
        return _("Use %s to host LVM and boot");
      }
      // TRANSLATORS: %s will be replaced by the device name and its size - "/dev/sda, 20 GiB"
      return _("Use %s to host LVM");
    }

    if (isBoot) {
      // TRANSLATORS: %s will be replaced by the device name and its size - "/dev/sda, 20 GiB"
      return _("Use %s to configure boot partitions");
    }
    // TRANSLATORS: %s will be replaced by the device name and its size - "/dev/sda, 20 GiB"
    return _("Use %s");
  };

  return (
    <DeviceHeader title={text(drive)}>
      <DriveDeviceMenu drive={drive} selected={driveDevice} />
    </DeviceHeader>
  );
};

export default function DriveEditor({ drive, driveDevice }: DriveEditorProps) {
  const driveModel = useDrive(drive.name);

  return (
    <Card isCompact>
      <CardHeader>
        <CardTitle>
          <DriveHeader drive={drive} driveDevice={driveDevice} />
        </CardTitle>
      </CardHeader>
      <CardBody className={spacingStyles.plLg}>
        <Flex direction={{ default: "column" }}>
          <SpacePolicyMenu modelDevice={driveModel} device={driveDevice} />
          <PartitionsMenu device={driveModel} />
        </Flex>
      </CardBody>
    </Card>
  );
}
