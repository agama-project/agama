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

// @ts-check

import React from "react";
import { Grid, GridItem } from "@patternfly/react-core";
import EncryptionField from "~/components/storage/EncryptionField";
import InstallationDeviceField from "~/components/storage/InstallationDeviceField";
import PartitionsField from "~/components/storage/PartitionsField";
import { _ } from "~/i18n";
import { compact } from "~/utils";
import { CHANGING, NOT_AFFECTED } from "~/components/storage/ProposalPage";

/**
 * @typedef {import ("~/client/storage").ProposalSettings} ProposalSettings
 * @typedef {import ("~/client/storage").ProposalTarget} ProposalTarget
 * @typedef {import ("~/client/storage").SpaceAction} SpaceAction
 * @typedef {import ("~/client/storage").StorageDevice} StorageDevice
 * @typedef {import ("~/client/storage").Volume} Volume
 */

/**
 * A helper function to decide whether to show the progress skeletons or not
 * for the specified component
 * @param {boolean} loading loading status
 * @param {string} component name of the component
 * @param {symbol} changing the item which is being changed
 * @returns {boolean} true if the skeleton should be displayed, false otherwise
 */
const showSkeleton = (loading, component, changing) => {
  return loading && !NOT_AFFECTED[component].includes(changing);
};

/**
 * Section for editing the proposal settings
 * @component
 *
 * @typedef {object} ProposalSettingsSectionProps
 * @property {ProposalSettings} settings
 * @property {StorageDevice[]} availableDevices
 * @property {StorageDevice[]} volumeDevices
 * @property {String[]} encryptionMethods
 * @property {Volume[]} volumeTemplates
 * @property {boolean} [isLoading=false]
 * @property {symbol} [changing=undefined] which part of the configuration is being changed by user
 * @property {(changing: symbol, settings: object) => void} onChange
 *
 * @param {ProposalSettingsSectionProps} props
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
}) {
  /** @param {import("~/components/storage/InstallationDeviceField").TargetConfig} targetConfig */
  const changeTarget = ({ target, targetDevice, targetPVDevices }) => {
    onChange(CHANGING.TARGET, {
      target,
      targetDevice: targetDevice?.name,
      targetPVDevices: targetPVDevices.map((d) => d.name),
    });
  };

  /** @param {import("~/components/storage/EncryptionField").EncryptionConfig} encryptionConfig */
  const changeEncryption = ({ password, method }) => {
    onChange(CHANGING.ENCRYPTION, { encryptionPassword: password, encryptionMethod: method });
  };

  /** @param {Volume[]} volumes */
  const changeVolumes = (volumes) => {
    onChange(CHANGING.VOLUMES, { volumes });
  };

  /** @param {import("~/components/storage/PartitionsField").BootConfig} bootConfig */
  const changeBoot = ({ configureBoot, bootDevice }) => {
    onChange(CHANGING.BOOT, {
      configureBoot,
      bootDevice: bootDevice?.name,
    });
  };

  /**
   * @param {string} name
   * @returns {StorageDevice|undefined}
   */
  const findDevice = (name) => availableDevices.find((a) => a.name === name);

  /** @type {StorageDevice|undefined} */
  const targetDevice = findDevice(settings.targetDevice);
  /** @type {StorageDevice[]} */
  const targetPVDevices = compact(settings.targetPVDevices?.map(findDevice) || []);
  const { volumes = [], installationDevices = [], spaceActions = [] } = settings;
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
          onBootChange={changeBoot}
        />
      </GridItem>
    </Grid>
  );
}
