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

/**
 * @typedef {import ("~/clients/storage").StorageDevice} StorageDevice
 * @typedef {import ("~/clients/storage").PartitionSlot} PartitionSlot
 */

/**
 * Class for managing storage devices.
 */
export default class DevicesManager {
  /**
   * @param {StorageDevice[]} system - Devices representing the current state of the system.
   * @param {StorageDevice[]} staging - Devices representing the target state of the system.
   */
  constructor(system, staging) {
    this.system = system;
    this.staging = staging;
  }

  /**
   * System device with the given SID.
   *
   * @param {Number} sid
   * @returns {StorageDevice|undefined}
   */
  systemDevice(sid) {
    return this.#device(sid, this.system);
  }

  /**
   * Staging device with the given SID.
   *
   * @param {Number} sid
   * @returns {StorageDevice|undefined}
   */
  stagingDevice(sid) {
    return this.#device(sid, this.staging);
  }

  /**
   * Whether the given device exists in system.
   *
   * @param {StorageDevice} device
   * @returns {Boolean}
   */
  existInSystem(device) {
    return this.#exist(device, this.system);
  }

  /**
   * Whether the given device exists in staging.
   *
   * @param {StorageDevice} device
   * @returns {Boolean}
   */
  existInStaging(device) {
    return this.#exist(device, this.staging);
  }

  /**
   * Whether the given device is going to be formatted.
   *
   * @param {StorageDevice} device
   * @returns {Boolean}
   */
  hasNewFilesystem(device) {
    if (!device.filesystem) return false;

    const systemDevice = this.systemDevice(device.sid);
    const systemFilesystemSID = systemDevice?.filesystem?.sid;

    return device.filesystem.sid !== systemFilesystemSID;
  }

  /**
   * Sorted list of children devices (i.e., partitions and unused slots or logical volumes).
   *
   * @param {StorageDevice} device
   * @returns {(StorageDevice|PartitionSlot)[]}
   */
  children(device) {
    if (device.partitionTable) return this.#partitionTableChildren(device.partitionTable);
    if (device.type === "lvmVg") return this.#lvmVgChildren(device);
    return [];
  }

  /**
   * Whether the given device is going to be shrunk.
   *
   * @param {StorageDevice} device
   * @returns {Boolean}
   */
  isResized(device) {
    return this.resizeSize(device) > 0;
  }

  /**
   * Amount of bytes the given device is going to be shrunk.
   *
   * @param {StorageDevice} device
   * @returns {Number}
   */
  resizeSize(device) {
    const systemDevice = this.systemDevice(device.sid);
    const stagingDevice = this.stagingDevice(device.sid);

    if (!systemDevice || !stagingDevice) return 0;

    return systemDevice.size - stagingDevice.size;
  }

  #device(sid, source) {
    return source.find(d => d.sid === sid);
  }

  #exist(device, source) {
    return this.#device(device.sid, source) !== undefined;
  }

  #partitionTableChildren(partitionTable) {
    const { partitions, unusedSlots } = partitionTable;
    const children = partitions.concat(unusedSlots);
    return children.sort((a, b) => a.start < b.start ? -1 : 1);
  }

  #lvmVgChildren(lvmVg) {
    return lvmVg.logicalVolumes.sort((a, b) => a.name < b.name ? -1 : 1);
  }
}
