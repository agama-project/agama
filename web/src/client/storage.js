/*
 * Copyright (c) [2022] SUSE LLC
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

import { DBusClient } from "./dbus";
import { WithStatus, WithValidation } from "./mixins";
import cockpit from "../lib/cockpit";

const STORAGE_SERVICE = "org.opensuse.DInstaller.Storage";
const STORAGE_PATH = "/org/opensuse/DInstaller/Storage1";
const STORAGE_PROPOSAL_IFACE = "org.opensuse.DInstaller.Storage.Proposal1";
const STORAGE_PROPOSAL_PATH = "/org/opensuse/DInstaller/Storage/Proposal1";

/**
 * Storage base client
 *
 * @ignore
 */
class StorageBaseClient {
  /**
   * @param {DBusClient} [dbusClient] - D-Bus client
   */
  constructor(dbusClient) {
    this.client = dbusClient || new DBusClient(STORAGE_SERVICE);
  }

  /**
   * Returns storage proposal values
   *
   * @return {Promise<object>}
   */
  async getProposal() {
    const proxy = await this.client.proxy(STORAGE_PROPOSAL_IFACE);

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
      availableDevices: proxy.AvailableDevices.map(([id, label]) => ({ id, label })),
      candidateDevices: proxy.CandidateDevices,
      lvm: proxy.LVM,
      encryptionPassword: proxy.EncryptionPassword,
      volumes: proxy.Volumes.map(volume),
      actions: proxy.Actions.map(action)
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
    const proxy = await this.client.proxy(STORAGE_PROPOSAL_IFACE);

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

  /**
   * Registers a callback to run when properties in the Storage Proposal object change
   *
   * @param {function} handler - callback function
   */
  onProposalChange(handler) {
    return this.client.onObjectChanged(STORAGE_PROPOSAL_PATH, STORAGE_PROPOSAL_IFACE, changes => {
      if (Array.isArray(changes.CandidateDevices.v)) {
        // FIXME return the proposal object (see getProposal)
        handler({ candidateDevices: changes.CandidateDevices.v });
      }
    });
  }

  /**
   * Registers a callback to run when properties in the Actions object change
   *
   * @param {function} handler - callback function
   */
  onActionsChange(handler) {
    return this.client.onObjectChanged(STORAGE_PROPOSAL_PATH, STORAGE_PROPOSAL_IFACE, changes => {
      const { Actions: actions } = changes;
      if (actions !== undefined && Array.isArray(actions.v)) {
        const newActions = actions.v.map(action => {
          const { Text: textVar, Subvol: subvolVar, Delete: deleteVar } = action;
          return { text: textVar.v, subvol: subvolVar.v, delete: deleteVar.v };
        });
        handler(newActions);
      }
    });
  }
}

/**
 * Allows interacting with the storage settings
 */
class StorageClient extends WithValidation(
  WithStatus(StorageBaseClient, STORAGE_PATH), STORAGE_PATH
) {}

export { StorageClient };
