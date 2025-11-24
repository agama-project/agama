/*
 * Copyright (c) [2024] SUSE LLC
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

import { unique } from "radashi";
import { compact } from "~/utils";
import { Action } from "~/api/proposal/storage";
import { storage as system } from "~/api/system";
import { storage as proposal } from "~/api/proposal";
import { deviceSystems, isDrive, isMd, isVolumeGroup } from "~/storage/helpers/device";

/**
 * Class for managing storage devices.
 */
export default class DevicesManager {
  system: system.Device[];
  staging: proposal.Device[];
  actions: Action[];

  /**
   * @param system - Devices representing the current state of the system.
   * @param staging - Devices representing the target state of the system.
   * @param actions - Actions to perform from system to staging.
   */
  constructor(system: system.Device[], staging: proposal.Device[], actions: Action[]) {
    this.system = system;
    this.staging = staging;
    this.actions = actions;
  }

  /**
   * System device with the given SID.
   */
  systemDevice(sid: number): system.Device | undefined {
    return this.system.find((d) => d.sid === sid);
  }

  /**
   * Staging device with the given SID.
   */
  stagingDevice(sid: number): proposal.Device {
    return this.staging.find((d) => d.sid === sid);
  }

  /**
   * Whether the given device exists in system.
   */
  existInSystem(device: system.Device): boolean {
    return this.system.find((d) => d.sid === device.sid) !== undefined;
  }

  /**
   * Whether the given device exists in staging.
   */
  existInStaging(device: proposal.Device): boolean {
    return this.staging.find((d) => d.sid === device.sid) !== undefined;
  }

  /**
   * Whether the given device is going to be formatted.
   */
  hasNewFilesystem(device: proposal.Device): boolean {
    if (!device.filesystem) return false;

    const systemDevice = this.systemDevice(device.sid);
    const systemFilesystemSID = systemDevice?.filesystem?.sid;

    return device.filesystem.sid !== systemFilesystemSID;
  }

  /**
   * Whether the given device is going to be shrunk.
   */
  isShrunk(device: proposal.Device): boolean {
    return this.shrinkSize(device) > 0;
  }

  /**
   * Amount of bytes the given device is going to be shrunk.
   */
  shrinkSize(device: proposal.Device): number {
    const systemDevice = this.systemDevice(device.sid);
    const stagingDevice = this.stagingDevice(device.sid);

    if (!systemDevice || !stagingDevice) return 0;

    const amount = systemDevice.block.size - stagingDevice.block.size;
    return amount > 0 ? amount : 0;
  }

  /**
   * Disk devices and LVM volume groups used for the installation.
   *
   * @note The used devices are extracted from the actions, but the optional argument
   * can be used to expand the list if some devices must be included despite not
   * being affected by the actions.
   *
   * @param knownNames - names of devices already known to be used, even if there are no actions on
   * them.
   */
  usedDevices(knownNames: string[] = []): proposal.Device[] {
    const isTarget = (device: system.Device | proposal.Device): boolean =>
      isDrive(device) || isMd(device) || isVolumeGroup(device);

    // Check in system devices to detect removals.
    const targetSystem = this.system.filter(isTarget);
    const targetStaging = this.staging.filter(isTarget);

    const sids = targetSystem
      .concat(targetStaging)
      .filter((d) => this.#isUsed(d) || knownNames.includes(d.name))
      .map((d) => d.sid);

    return compact(unique(sids).map((sid) => this.stagingDevice(sid)));
  }

  /**
   * Devices deleted.
   *
   * @note The devices are extracted from the actions.
   */
  deletedDevices(): system.Device[] {
    return this.#deleteActionsDevice().filter((d) => !isDrive(d));
  }

  /**
   * Devices resized.
   *
   * @note The devices are extracted from the actions.
   */
  resizedDevices(): system.Device[] {
    return this.#resizeActionsDevice().filter((d) => !isDrive(d));
  }

  /**
   * Systems deleted.
   */
  deletedSystems(): string[] {
    const systems = this.#deleteActionsDevice()
      .filter((d) => !d.partitionTable)
      .map(deviceSystems)
      .flat();
    return compact(systems);
  }

  /**
   * Systems resized.
   */
  resizedSystems(): string[] {
    const systems = this.#resizeActionsDevice()
      .filter((d) => !d.partitionTable)
      .map(deviceSystems)
      .flat();
    return compact(systems);
  }

  #isUsed(device: system.Device | proposal.Device): boolean {
    const sids = unique(compact(this.actions.map((a) => a.device)));

    const partitions = device.partitions || [];
    const lvmLvs = device.logicalVolumes || [];

    return (
      sids.includes(device.sid) ||
      partitions.find((p) => this.#isUsed(p)) !== undefined ||
      lvmLvs.find((l) => this.#isUsed(l)) !== undefined
    );
  }

  #deleteActionsDevice(): system.Device[] {
    const sids = this.actions.filter((a) => a.delete).map((a) => a.device);
    const devices = sids.map((sid) => this.systemDevice(sid));
    return compact(devices);
  }

  #resizeActionsDevice(): system.Device[] {
    const sids = this.actions.filter((a) => a.resize).map((a) => a.device);
    const devices = sids.map((sid) => this.systemDevice(sid));
    return compact(devices);
  }
}
