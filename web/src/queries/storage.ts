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

import { useQuery, useSuspenseQueries, useSuspenseQuery } from "@tanstack/react-query";
import { fetchDevices } from "~/api/storage/devices";
import { fetchActions, fetchDefaultVolume, fetchProductParams, fetchSettings, fetchUsableDevices } from "~/api/storage/proposal";
import { ProductParams, Volume as APIVolume, ProposalSettings, ProposalTarget as APIProposalTarget } from "~/api/storage/types";
import { ProposalResult, ProposalTarget, StorageDevice, Volume, VolumeTarget } from "~/types/storage";
import { compact, uniq } from "~/utils";

const devicesQuery = (scope: "result" | "system") => ({
  queryKey: ["storage", "devices", scope],
  queryFn: () => fetchDevices(scope),
  staleTime: Infinity
});

const usableDevicesQuery = {
  queryKey: ["storage", "usableDevices"],
  queryFn: fetchUsableDevices,
  staleTime: Infinity
};

const productParamsQuery = {
  queryKey: ["storage", "encryptionMethods"],
  queryFn: fetchProductParams,
  staleTime: Infinity
}

const defaultVolumeQuery = (mountPath: string) => ({
  queryKey: ["storage", "volumeFor", mountPath],
  queryFn: () => fetchDefaultVolume(mountPath),
  staleTime: Infinity
});

/**
 * Hook that returns the list of storage devices for the given scope
 *
 * @param scope - "system": devices in the current state of the system; "result":
 *   devices in the proposal ("stage")
 */
const useDevices = (scope: "result" | "system", options?: QueryHookOptions): StorageDevice[] | undefined => {
  const query = devicesQuery(scope);
  const func = options?.suspense ? useSuspenseQuery : useQuery;
  const { data } = func(query);
  return data;
}

/**
 * Hook that returns the list of available devices for installation.
 */
const useAvailableDevices = () => {
  const findDevice = (devices: StorageDevice[], sid: number) => {
    const device = devices.find((d) => d.sid === sid);

    if (device === undefined) console.warn("Device not found:", sid);

    return device;
  };

  const devices = useDevices("system", { suspense: true });
  const { data } = useSuspenseQuery(usableDevicesQuery);

  return data.map((sid) => findDevice(devices, sid)).filter((d) => d);
}

/**
 * Hook that returns the product parameters (e.g., mount points).
 */
const useProductParams = (options?: QueryHookOptions): ProductParams => {
  const func = options?.suspense ? useSuspenseQuery : useQuery;
  const { data } = func(productParamsQuery);
  return data;
}

/**
 * Hook that returns the volume templates for the current product.
 */
const useVolumeTemplates = (options?: QueryHookOptions): Volume[] => {
  const systemDevices = useDevices("system", { suspense: true });
  const product = useProductParams(options || {});
  if (!product) return [];

  const queries = product.mountPoints.map((p) => defaultVolumeQuery(p));
  queries.push(defaultVolumeQuery(""));
  const results = useSuspenseQueries({ queries }) as Array<{ data: APIVolume }>;
  return results.map(({ data }) => buildVolume(data, systemDevices, product.mountPoints));
}

/**
 * Hook that returns the devices that can be selected as target for volume.
 *
 * A device can be selected as target for a volume if either it is an available device for
 * installation or it is a device built over the available devices for installation. For example,
 * a MD RAID is a possible target only if all its members are available devices or children of the
 * available devices.
 */
const useVolumeDevices = (): StorageDevice[] => {
  const isAvailable = (device: StorageDevice) => {
    const isChildren = (device: StorageDevice, parentDevice: StorageDevice) => {
      const partitions = parentDevice.partitionTable?.partitions || [];
      return !!partitions.find((d) => d.name === device.name);
    };

    return !!availableDevices.find((d) => d.name === device.name || isChildren(device, d));
  };

  const allAvailable = (devices: StorageDevice[]) => devices.every(isAvailable);

  const availableDevices = useAvailableDevices();
  const system = useDevices("system", { suspense: true });
  const mds = system.filter((d) => d.type === "md" && allAvailable(d.devices));
  const vgs = system.filter((d) => d.type === "lvmVg" && allAvailable(d.physicalVolumes));

  return [...availableDevices, ...mds, ...vgs];
}

const proposalSettingsQuery = {
  queryKey: ["storage", "proposal", "settings"],
  queryFn: fetchSettings
};

const proposalActionsQuery = {
  queryKey: ["storage", "proposal", "actions"],
  queryFn: fetchActions
};

/**
 * Gets the values of the current proposal
 */
const useProposalResult = (): ProposalResult | undefined => {
  const buildTarget = (value: APIProposalTarget): ProposalTarget => {
    // FIXME: handle the case where they do not match
    const target = value as ProposalTarget;
    return target;
  }

  /** @todo Read installation devices from D-Bus. */
  const buildInstallationDevices = (settings: ProposalSettings, devices: StorageDevice[]) => {
    const findDevice = (name: string) => {
      const device = devices.find((d) => d.name === name);

      if (device === undefined) console.error("Device object not found: ", name);

      return device;
    };

    // Only consider the device assigned to a volume as installation device if it is needed
    // to find space in that device. For example, devices directly formatted or mounted are not
    // considered as installation devices.
    const volumes = settings.volumes.filter((vol) => {
      return true;
      // const target = vol.target as VolumeTarget;
      // return [VolumeTarget.NEW_PARTITION, VolumeTarget.NEW_VG].includes(target);
    });

    const values = [
      settings.targetDevice,
      settings.targetPVDevices,
      volumes.map((v) => v.targetDevice),
    ].flat();

    if (settings.configureBoot) values.push(settings.bootDevice);

    const names = uniq(compact(values)).filter((d) => d.length > 0);

    // #findDevice returns undefined if no device is found with the given name.
    return compact(names.sort().map(findDevice));
  };

  const [
    { data: settings }, { data: actions }
  ] = useSuspenseQueries({ queries: [proposalSettingsQuery, proposalActionsQuery] });
  const systemDevices = useDevices("system", { suspense: true });
  const { mountPoints: productMountPoints } = useProductParams({ suspense: true });

  return {
    settings: {
      ...settings,
      targetPVDevices: settings.targetPVDevices || [],
      target: buildTarget(settings.target),
      volumes: settings.volumes.map((v) =>
        buildVolume(v, systemDevices, productMountPoints),
      ),
      // NOTE: strictly speaking, installation devices does not belong to the settings. It
      // should be a separate method instead of an attribute in the settings object.
      // Nevertheless, it was added here for simplicity and to avoid passing more props in some
      // react components. Please, do not use settings as a jumble.
      installationDevices: buildInstallationDevices(settings, systemDevices),
    },
    actions,
  };
}

/**
 * @private
 * Builds a volume from the D-Bus data
 */
const buildVolume = (rawVolume: APIVolume, devices: StorageDevice[], productMountPoints: string[]): Volume => {
  const outline = {
    ...rawVolume.outline,
    // Indicate whether a volume is defined by the product.
    productDefined: productMountPoints.includes(rawVolume.mountPath)
  };
  const volume: Volume = {
    ...rawVolume,
    outline,
    minSize: rawVolume.minSize || 0,
    transactional: rawVolume.transactional || false,
    target: rawVolume.target as VolumeTarget,
    targetDevice: devices.find((d) => d.name === rawVolume.targetDevice),
  };

  return volume;
}

export {
  useDevices,
  useAvailableDevices,
  useProductParams,
  useVolumeTemplates,
  useVolumeDevices,
  useProposalResult
}
