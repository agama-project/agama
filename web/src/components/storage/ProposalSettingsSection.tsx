/*
 * Copyright (c) [2022-2024] SUSE LLC
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

import React from "react";
import { Grid, GridItem } from "@patternfly/react-core";
import EncryptionField, { EncryptionConfig } from "~/components/storage/EncryptionField";
import InstallationDeviceField from "~/components/storage/InstallationDeviceField";
import PartitionsField from "~/components/storage/PartitionsField";
import { TargetConfig } from "~/components/storage/InstallationDeviceField";
import { BootConfig } from "~/components/storage/BootConfigField";
import { CHANGING, NOT_AFFECTED } from "~/components/storage/ProposalPage";
import { ProposalSettings, StorageDevice, Volume } from "~/types/storage";
import { _ } from "~/i18n";
import { compact } from "~/utils";

/**
 * A helper function to decide whether to show the progress skeletons or not
 * for the specified component
 * @param loading - loading status
 * @param component - name of the component
 * @param changing - the item which is being changed
 * @returns {boolean} true if the skeleton should be displayed, false otherwise
 */
const showSkeleton = (loading: boolean, component: string, changing: symbol): boolean => {
  return loading && !NOT_AFFECTED[component].includes(changing);
};

export type ProposalSettingsSectionProps = {
  settings: ProposalSettings;
  availableDevices: StorageDevice[];
  volumeDevices: StorageDevice[];
  encryptionMethods: string[];
  volumeTemplates: Volume[];
  isLoading?: boolean;
  changing?: symbol;
  onChange: (changing: symbol, settings: object) => void;
}

/**
 * Section for editing the proposal settings
 * @component
 */
export default function ProposalSettingsSection({
  settings,
  availableDevices,
  volumeDevices,
  encryptionMethods,
  volumeTemplates,
  isLoading = false,
  changing = undefined,
  onChange,
}: ProposalSettingsSectionProps) {
  const changeTarget = ({ target, targetDevice, targetPVDevices }: TargetConfig) => {
    onChange(CHANGING.TARGET, {
      target,
      targetDevice: targetDevice?.name,
      targetPVDevices: targetPVDevices.map((d) => d.name),
    });
  };

  const changeEncryption = ({ password, method }: EncryptionConfig) => {
    onChange(CHANGING.ENCRYPTION, { encryptionPassword: password, encryptionMethod: method });
  };

  const changeVolumes = (volumes: Volume[]) => {
    onChange(CHANGING.VOLUMES, { volumes });
  };

  /**
   * @param {string} name
   * @returns {StorageDevice|undefined}
   */
  const findDevice = (name: string): StorageDevice | undefined => availableDevices.find((a) => a.name === name);

  const targetDevice: StorageDevice | undefined = findDevice(settings.targetDevice);
  const targetPVDevices: StorageDevice[] = compact(settings.targetPVDevices?.map(findDevice) || []);
  const { volumes = [] } = settings;
  const bootDevice = findDevice(settings.bootDevice);
  const defaultBootDevice = findDevice(settings.defaultBootDevice);
  const targetDevices = compact([targetDevice, ...targetPVDevices]);

  return (
    <Grid hasGutter>
      <GridItem sm={12} xl2={6}>
        <InstallationDeviceField
          target={settings.target}
          targetDevice={targetDevice}
          targetPVDevices={targetPVDevices}
          devices={availableDevices}
          isLoading={showSkeleton(isLoading, "InstallationDeviceField", changing)}
          onChange={changeTarget}
        />
      </GridItem>
      <GridItem sm={12} xl2={6}>
        <EncryptionField
          password={settings.encryptionPassword || ""}
          method={settings.encryptionMethod}
          methods={encryptionMethods}
          isLoading={settings.encryptionPassword === undefined}
          onChange={changeEncryption}
        />
      </GridItem>
      <GridItem>
        <PartitionsField
          volumes={volumes}
          templates={volumeTemplates}
          availableDevices={availableDevices}
          volumeDevices={volumeDevices}
          target={settings.target}
          targetDevices={targetDevices}
          configureBoot={settings.configureBoot}
          bootDevice={bootDevice}
          defaultBootDevice={defaultBootDevice}
          isLoading={
            showSkeleton(isLoading, "PartitionsField", changing) || settings.volumes === undefined
          }
          onVolumesChange={changeVolumes}
        />
      </GridItem>
    </Grid>
  );
}
