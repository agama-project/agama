/*
 * Copyright (c) [2026] SUSE LLC
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

/**
 * Transformations between the storage configuration and the volume group form.
 *
 * Kept free of React so they can be tested on their own.
 */

import configModel from "~/model/storage/config-model";
import type { ConfigModel, Data } from "~/model/storage/config-model";
import type { Storage as System } from "~/model/system";
import type { FormFields } from "./fields";

/** Name proposed for the first volume group of the configuration. */
const DEFAULT_VOLUME_GROUP_NAME = "system";

/**
 * Names of the devices, among the available ones, that are listed in
 * `candidates`.
 *
 * The order of the available devices is kept, so it does not depend on how the
 * configuration happens to list them.
 */
function availableAmong(candidates: string[], devices: System.Device[]): string[] {
  return devices.map((d) => d.name).filter((name) => candidates.includes(name));
}

/**
 * Names of the volume groups already configured, leaving out the one being
 * edited, so keeping its own name is not reported as a duplicate.
 *
 * @param config - The storage configuration.
 * @param volumeGroup - The volume group being edited, if any.
 */
export function usedVolumeGroupNames(
  config: ConfigModel.Config | null,
  volumeGroup?: ConfigModel.VolumeGroup | null,
): string[] {
  const names = (config?.volumeGroups || []).map((v) => v.vgName);
  return names.filter((name) => name !== volumeGroup?.vgName);
}

/**
 * Initial values of the form.
 *
 * - Editing: the name and the target devices of the volume group.
 * - Creating the first volume group: the usual name, with the devices where
 *   partitions are being added, which are the ones usually meant to hold it.
 * - Creating any other: nothing, so the user decides.
 *
 * Target devices that are not among the available ones are left out.
 *
 * @param config - The storage configuration.
 * @param volumeGroup - The volume group being edited, if any.
 * @param devices - Devices that can hold physical volumes.
 */
export function toFormValues(
  config: ConfigModel.Config | null,
  volumeGroup: ConfigModel.VolumeGroup | null | undefined,
  devices: System.Device[],
): Partial<FormFields> {
  if (volumeGroup && config) {
    const targets = configModel.volumeGroup
      .filterTargetDevices(config, volumeGroup)
      .map((d) => d.name);

    return { vgName: volumeGroup.vgName, targetDevices: availableAmong(targets, devices) };
  }

  if (config && !config.volumeGroups?.length) {
    const candidates = [...(config.drives || []), ...(config.mdRaids || [])];
    const targets = candidates.filter(configModel.partitionable.isAddingPartitions);

    return {
      vgName: DEFAULT_VOLUME_GROUP_NAME,
      targetDevices: availableAmong(
        targets.map((d) => d.name),
        devices,
      ),
    };
  }

  return {};
}

/**
 * Data of the volume group to send to the model from the form values.
 *
 * @param values - The form values.
 */
export function buildPayload(values: FormFields): Data.VolumeGroup {
  return { vgName: values.vgName, targetDevices: values.targetDevices };
}
