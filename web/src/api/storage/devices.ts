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

import { get } from "~/api/http";
import {
  Component,
  Device,
  DevicesDirtyResponse,
  Drive,
  Filesystem,
  LvmVg,
  Md,
  Multipath,
  Partition,
  PartitionTable,
  Raid,
} from "./types";
import { StorageDevice } from "~/types/storage";

/**
 * Returns the list of devices in the given scope
 *
 * @param scope - "system": devices in the current state of the system; "result":
 *   devices in the proposal ("stage")
 */
const fetchDevices = async (scope: "result" | "system") => {
  const buildDevice = (jsonDevice: Device, jsonDevices: Device[]) => {
    const buildDefaultDevice = (): StorageDevice => {
      return {
        sid: 0,
        name: "",
        description: "",
        isDrive: false,
        type: "drive",
      };
    };

    const buildCollectionFromNames = (names: string[]): StorageDevice[] => {
      return names.map((name) => ({ ...buildDefaultDevice(), name }));
    };

    const buildCollection = (sids: number[], jsonDevices: Device[]): StorageDevice[] => {
      if (sids === null || sids === undefined) return [];

      return sids.map((sid) =>
        buildDevice(
          jsonDevices.find((dev) => dev.deviceInfo?.sid === sid),
          jsonDevices,
        ),
      );
    };

    const addDriveInfo = (device: StorageDevice, info: Drive) => {
      device.isDrive = true;
      device.type = info.type;
      device.vendor = info.vendor;
      device.model = info.model;
      device.driver = info.driver;
      device.bus = info.bus;
      device.busId = info.busId;
      device.transport = info.transport;
      device.sdCard = info.info.sdCard;
      device.dellBOSS = info.info.dellBOSS;
    };

    const addRaidInfo = (device: StorageDevice, info: Raid) => {
      device.devices = buildCollectionFromNames(info.devices);
    };

    const addMultipathInfo = (device: StorageDevice, info: Multipath) => {
      device.wires = buildCollectionFromNames(info.wires);
    };

    const addMDInfo = (device: StorageDevice, info: Md) => {
      device.type = "md";
      device.level = info.level;
      device.uuid = info.uuid;
      device.devices = buildCollection(info.devices, jsonDevices);
    };

    const addPartitionInfo = (device: StorageDevice, info: Partition) => {
      device.type = "partition";
      device.isEFI = info.efi;
    };

    const addVgInfo = (device: StorageDevice, info: LvmVg) => {
      device.type = "lvmVg";
      device.size = info.size;
      device.physicalVolumes = buildCollection(info.physicalVolumes, jsonDevices);
      device.logicalVolumes = buildCollection(info.logicalVolumes, jsonDevices);
    };

    const addLvInfo = (device: StorageDevice) => {
      device.type = "lvmLv";
    };

    const addPTableInfo = (device: StorageDevice, tableInfo: PartitionTable) => {
      const partitions = buildCollection(tableInfo.partitions, jsonDevices);
      device.partitionTable = {
        type: tableInfo.type,
        partitions,
        unpartitionedSize: device.size - partitions.reduce((s, p) => s + p.size, 0),
        unusedSlots: tableInfo.unusedSlots.map((s) => Object.assign({}, s)),
      };
    };

    const addFilesystemInfo = (device: StorageDevice, filesystemInfo: Filesystem) => {
      const buildMountPath = (path: string) => (path.length > 0 ? path : undefined);
      const buildLabel = (label: string) => (label.length > 0 ? label : undefined);
      device.filesystem = {
        sid: filesystemInfo.sid,
        type: filesystemInfo.type,
        mountPath: buildMountPath(filesystemInfo.mountPath),
        label: buildLabel(filesystemInfo.label),
      };
    };

    const addComponentInfo = (device: StorageDevice, info: Component) => {
      device.component = {
        type: info.type,
        deviceNames: info.deviceNames,
      };
    };

    const device = buildDefaultDevice();

    const process = (jsonProperty: string, method: Function) => {
      const info = jsonDevice[jsonProperty];
      if (info === undefined || info === null) return;

      method(device, info);
    };

    process("deviceInfo", Object.assign);
    process("drive", addDriveInfo);
    process("raid", addRaidInfo);
    process("multipath", addMultipathInfo);
    process("md", addMDInfo);
    process("blockDevice", Object.assign);
    process("partition", addPartitionInfo);
    process("lvmVg", addVgInfo);
    process("lvmLv", addLvInfo);
    process("partitionTable", addPTableInfo);
    process("filesystem", addFilesystemInfo);
    process("component", addComponentInfo);

    return device;
  };

  const jsonDevices: Device[] = await get(`/api/storage/devices/${scope}`);
  return jsonDevices.map((d) => buildDevice(d, jsonDevices));
};

const fetchDevicesDirty = (): Promise<DevicesDirtyResponse> => get("/api/storage/devices/dirty");

export { fetchDevices, fetchDevicesDirty };
