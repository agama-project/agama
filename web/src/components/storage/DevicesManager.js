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

// @ts-check

import { compact, uniq } from "~/utils";

/**
 * @typedef {import ("~/client/storage").Action} Action
 * @typedef {import ("~/client/storage").StorageDevice} StorageDevice
 */

/**
 * Class for managing storage devices.
 */
export default class DevicesManager {
  /**
   * @constructor
   *
   * @param {StorageDevice[]} system - Devices representing the current state of the system.
   * @param {StorageDevice[]} staging - Devices representing the target state of the system.
   * @param {Action[]} actions - Actions to perform from system to staging.
   */
  constructor(system, staging, actions) {
    this.system = system;
    this.staging = staging;
    this.actions = actions;
  }

  /**
   * System device with the given SID.
   * @method
   *
   * @param {Number} sid
   * @returns {StorageDevice|undefined}
   */
  systemDevice(sid) {
    return this.#device(sid, this.system);
  }

  /**
   * Staging device with the given SID.
   * @method
   *
   * @param {Number} sid
   * @returns {StorageDevice|undefined}
   */
  stagingDevice(sid) {
    return this.#device(sid, this.staging);
  }

  /**
   * Whether the given device exists in system.
   * @method
   *
   * @param {StorageDevice} device
   * @returns {Boolean}
   */
  existInSystem(device) {
    return this.#exist(device, this.system);
  }

  /**
   * Whether the given device exists in staging.
   * @method
   *
   * @param {StorageDevice} device
   * @returns {Boolean}
   */
  existInStaging(device) {
    return this.#exist(device, this.staging);
  }

  /**
   * Whether the given device is going to be formatted.
   * @method
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
   * Whether the given device is going to be shrunk.
   * @method
   *
   * @param {StorageDevice} device
   * @returns {Boolean}
   */
  isShrunk(device) {
    return this.shrinkSize(device) > 0;
  }

  /**
   * Amount of bytes the given device is going to be shrunk.
   * @method
   *
   * @param {StorageDevice} device
   * @returns {Number}
   */
  shrinkSize(device) {
    const systemDevice = this.systemDevice(device.sid);
    const stagingDevice = this.stagingDevice(device.sid);

    if (!systemDevice || !stagingDevice) return 0;

    const amount = systemDevice.size - stagingDevice.size;
    return amount > 0 ? amount : 0;
  }

  /**
   * Disk devices and LVM volume groups used for the installation.
   * @method
   *
   * @note The used devices are extracted from the actions.
   *
   * @returns {StorageDevice[]}
   */
  usedDevices() {
    const isTarget = (device) => device.isDrive || ["md", "lvmVg"].includes(device.type);

    // Check in system devices to detect removals.
    const targetSystem = this.system.filter(isTarget);
    const targetStaging = this.staging.filter(isTarget);

    const sids = targetSystem.concat(targetStaging)
      .filter(d => this.#isUsed(d))
      .map(d => d.sid);

    return compact(uniq(sids).map(sid => this.stagingDevice(sid)));
  }

  /**
   * Devices deleted.
   * @method
   *
   * @note The devices are extracted from the actions.
   *
   * @returns {StorageDevice[]}
   */
  deletedDevices() {
    return this.#deleteActionsDevice().filter(d => !d.isDrive);
  }

  /**
   * Devices resized.
   * @method
   *
   * @note The devices are extracted from the actions.
   *
   * @returns {StorageDevice[]}
   */
  resizedDevices() {
    return this.#resizeActionsDevice().filter(d => !d.isDrive);
  }

  /**
   * Systems deleted.
   * @method
   *
   * @returns {string[]}
   */
  deletedSystems() {
    const systems = this.#deleteActionsDevice()
      .filter(d => !d.partitionTable)
      .map(d => d.systems)
      .flat();
    return compact(systems);
  }

  /**
   * Systems resized.
   * @method
   *
   * @returns {string[]}
   */
  resizedSystems() {
    const systems = this.#resizeActionsDevice()
      .filter(d => !d.partitionTable)
      .map(d => d.systems)
      .flat();
    return compact(systems);
  }

  /**
   * @param {number} sid
   * @param {StorageDevice[]} source
   * @returns {StorageDevice|undefined}
   */
  #device(sid, source) {
    return source.find(d => d.sid === sid);
  }

  /**
   * @param {StorageDevice} device
   * @param {StorageDevice[]} source
   * @returns {boolean}
   */
  #exist(device, source) {
    return this.#device(device.sid, source) !== undefined;
  }

  /**
   * @param {StorageDevice} device
   * @returns {boolean}
   */
  #isUsed(device) {
    const sids = uniq(compact(this.actions.map(a => a.device)));

    const partitions = device.partitionTable?.partitions || [];
    const lvmLvs = device.logicalVolumes || [];

    return sids.includes(device.sid) ||
      partitions.find(p => this.#isUsed(p)) !== undefined ||
      lvmLvs.find(l => this.#isUsed(l)) !== undefined;
  }

  /**
   * @returns {StorageDevice[]}
   */
  #deleteActionsDevice() {
    const sids = this.actions
      .filter(a => a.delete)
      .map(a => a.device);
    const devices = sids.map(sid => this.systemDevice(sid));
    return compact(devices);
  }

  /**
   * @returns {StorageDevice[]}
   */
  #resizeActionsDevice() {
    const sids = this.actions
      .filter(a => a.resize)
      .map(a => a.device);
    const devices = sids.map(sid => this.systemDevice(sid));
    return compact(devices);
  }
}
