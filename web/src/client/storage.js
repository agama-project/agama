/*
 * Copyright (c) [2022-2023] SUSE LLC
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

import DBusClient from "./dbus";
import { WithStatus, WithValidation } from "./mixins";
import cockpit from "../lib/cockpit";

const STORAGE_SERVICE = "org.opensuse.DInstaller.Storage";
const STORAGE_PATH = "/org/opensuse/DInstaller/Storage1";
const PROPOSAL_CALCULATOR_IFACE = "org.opensuse.DInstaller.Storage1.Proposal.Calculator";
const PROPOSAL_IFACE = "org.opensuse.DInstaller.Storage1.Proposal";

/**
 * Storage base client
 *
 * @ignore
 */
class StorageBaseClient {
  /**
   * @param {string|undefined} address - D-Bus address; if it is undefined, it uses the system bus.
   */
  constructor(address = undefined) {
    this.client = new DBusClient(STORAGE_SERVICE, address);
  }

  /**
   * Returns storage proposal values
   *
   * @return {Promise<object>}
   */
  async getProposal() {
    const storageProxy = await this.client.proxy(PROPOSAL_CALCULATOR_IFACE, STORAGE_PATH);
    const proposalProxy = await this.client.proxy(PROPOSAL_IFACE).catch(() => undefined);

    // Check whether proposal object is already exported
    if (!proposalProxy?.valid) return {};

    const volume = dbusVolume => {
      const valueFrom = dbusValue => dbusValue?.v;

      const valuesFrom = (dbusValues) => {
        if (dbusValues === undefined) return [];
        return dbusValues.v.map(valueFrom);
      };

      return {
        mountPoint: valueFrom(dbusVolume.MountPoint),
        optional: valueFrom(dbusVolume.Optional),
        deviceType: valueFrom(dbusVolume.DeviceType),
        encrypted: valueFrom(dbusVolume.Encrypted),
        fsTypes: valuesFrom(dbusVolume.FsTypes),
        fsType: valueFrom(dbusVolume.FsType),
        minSize: valueFrom(dbusVolume.MinSize),
        maxSize: valueFrom(dbusVolume.MaxSize),
        fixedSizeLimits: valueFrom(dbusVolume.FixedSizeLimits),
        adaptiveSizes: valueFrom(dbusVolume.AdaptiveSizes),
        snapshots: valueFrom(dbusVolume.Snapshots),
        snapshotsConfigurable: valueFrom(dbusVolume.SnapshotsConfigurable),
        snapshotsAffectSizes: valueFrom(dbusVolume.SnapshotsAffectSizes),
        sizeRelevantVolumes: valueFrom(dbusVolume.SizeRelevantVolumes)
      };
    };

    const action = dbusAction => {
      const { Text: { v: textVar }, Subvol: { v: subvolVar }, Delete: { v: deleteVar } } = dbusAction;
      return { text: textVar, subvol: subvolVar, delete: deleteVar };
    };

    return {
      availableDevices: storageProxy.AvailableDevices.map(([id, label]) => ({ id, label })),
      candidateDevices: proposalProxy.CandidateDevices,
      lvm: proposalProxy.LVM,
      encryptionPassword: proposalProxy.EncryptionPassword,
      volumes: proposalProxy.Volumes.map(volume),
      actions: proposalProxy.Actions.map(action)
    };
  }

  /**
   * Calculates a new proposal
   *
   * @param {object} settings - proposal settings
   * @param {?string[]} [settings.candidateDevices] - Devices to use for the proposal
   * @param {?string} [settings.encryptionPassword] - Password for encrypting devices
   * @param {?boolean} [settings.lvm] - Whether to calculate the proposal with LVM volumes
   * @param {?object[]} [settings.volumes] - Volumes to create
   * @return {Promise<number>} - 0 success, other for failure
   */
  async calculateProposal({ candidateDevices, encryptionPassword, lvm, volumes }) {
    const proxy = await this.client.proxy(PROPOSAL_CALCULATOR_IFACE, STORAGE_PATH);

    // Builds a new object without undefined attributes
    const cleanObject = (object) => {
      const newObject = { ...object };

      Object.keys(newObject).forEach(key => newObject[key] === undefined && delete newObject[key]);
      return newObject;
    };

    // Builds the cockpit object or returns undefined if there is no value
    const cockpitValue = (type, value) => {
      if (value === undefined) return undefined;

      return cockpit.variant(type, value);
    };

    const dbusVolume = (volume) => {
      return cleanObject({
        MountPoint: cockpitValue("s", volume.mountPoint),
        Encrypted: cockpitValue("b", volume.encrypted),
        FsType: cockpitValue("s", volume.fsType),
        MinSize: cockpitValue("x", volume.minSize),
        MaxSize: cockpitValue("x", volume.maxSize),
        FixedSizeLimits: cockpitValue("b", volume.fixedSizeLimits),
        Snapshots: cockpitValue("b", volume.snapshots)
      });
    };

    const dbusVolumes = (volumes) => {
      if (!volumes) return undefined;

      return volumes.map(dbusVolume);
    };

    const settings = cleanObject({
      CandidateDevices: cockpitValue("as", candidateDevices),
      EncryptionPassword: cockpitValue("s", encryptionPassword),
      LVM: cockpitValue("b", lvm),
      Volumes: cockpitValue("aa{sv}", dbusVolumes(volumes))
    });

    return proxy.Calculate(settings);
  }
}

/**
 * Allows interacting with the storage settings
 */
class StorageClient extends WithValidation(
  WithStatus(StorageBaseClient, STORAGE_PATH), STORAGE_PATH
) {}

export { StorageClient };
