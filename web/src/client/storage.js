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

const SERVICE = "org.opensuse.DInstaller.Storage";
const STORAGE_OBJECT = "/org/opensuse/DInstaller/Storage1";
const ISCSI_NODES_NAMESPACE = "/org/opensuse/DInstaller/Storage1/iscsi_nodes";
const PROPOSAL_CALCULATOR_IFACE = "org.opensuse.DInstaller.Storage1.Proposal.Calculator";
const ISCSI_INITIATOR_IFACE = "org.opensuse.DInstaller.Storage1.ISCSI.Initiator";
const PROPOSAL_IFACE = "org.opensuse.DInstaller.Storage1.Proposal";
const ISCSI_NODE_IFACE = "org.opensuse.DInstaller.Storage1.ISCSI.Node";

/**
 * Removes properties with undefined value
 *
 * @example
 * removeUndefinedCockpitProperties({
 *  property1: { t: "s", v: "foo" },
 *  property2: { t: b, v: false },
 *  property3: { t: "s", v: undefined }
 * });
 * //returns { property1: { t: "s", v: "foo" }, property2: { t: "b", v: false } }
 *
 * @param {object} cockpitObject
 * @returns {object}
 */
const removeUndefinedCockpitProperties = (cockpitObject) => {
  const filtered = Object.entries(cockpitObject).filter(([, { v }]) => v !== undefined);
  return Object.fromEntries(filtered);
};

/**
 * Class providing an API for managing the storage proposal through D-Bus
 */
class ProposalManager {
  /**
   * @param {DBusClient} client
   */
  constructor(client) {
    this.client = client;
    this.proxies = {};
  }

  async setUp() {
    const proposalCalculator = await this.client.proxy(PROPOSAL_CALCULATOR_IFACE, STORAGE_OBJECT);

    this.proxies = { proposalCalculator };
  }

  /**
   * Gets data associated to the proposal
   *
   * @returns {Promise<ProposalData>}
   *
   * @typedef {object} ProposalData
   * @property {AvailableDevice[]} availableDevices
   * @property {Result} result
   */
  async getData() {
    const availableDevices = await this.getAvailableDevices();
    const result = await this.getResult();

    return { availableDevices, result };
  }

  /**
   * Gets the list of available devices
   *
   * @returns {Promise<AvailableDevice[]>}
   *
   * @typedef {object} AvailableDevice
   * @property {string} id - Device kernel name
   * @property {string} label - Device description
   */
  async getAvailableDevices() {
    const buildDevice = dbusDevice => {
      return {
        id: dbusDevice[0],
        label: dbusDevice[1]
      };
    };

    return this.proxies.proposalCalculator.AvailableDevices.map(buildDevice);
  }

  /**
   * Gets the values of the current proposal
   *
   * @return {Promise<Result>}
   *
   * @typedef {object} Result
   * @property {string[]} candidateDevices
   * @property {boolean} lvm
   * @property {string} encryptionPassword
   * @property {Volume[]} volumes
   * @property {Action[]} actions
   *
   * @typedef {object} Volume
   * @property {string} [deviceType]
   * @property {boolean} [optional]
   * @property {string} [mountPoint]
   * @property {boolean} [fixedSizeLimits]
   * @property {number} [minSize]
   * @property {number} [maxSize]
   * @property {string[]} [fsTypes]
   * @property {string} [fsType]
   * @property {boolean} [snapshots]
   * @property {boolean} [snapshotsConfigurable]
   * @property {boolean} [snapshotsAffectSizes]
   * @property {string[]} [sizeRelevantVolumes]
   *
   * @typedef {object} Action
   * @property {string} text
   * @property {boolean} subvol
   * @property {boolean} delete
  */
  async getResult() {
    const proxy = await this.proposalProxy();

    if (!proxy) return undefined;

    const buildResult = (proxy) => {
      const buildVolume = dbusVolume => {
        const buildList = (value) => {
          if (value === undefined) return [];

          return value.map(val => val.v);
        };

        return {
          deviceType: dbusVolume.DeviceType?.v,
          optional: dbusVolume.Optional?.v,
          encrypted: dbusVolume.Encrypted?.v,
          mountPoint: dbusVolume.MountPoint?.v,
          fixedSizeLimits: dbusVolume.FixedSizeLimits?.v,
          adaptiveSizes: dbusVolume.AdaptiveSizes?.v,
          minSize: dbusVolume.MinSize?.v,
          maxSize: dbusVolume.MaxSize?.v,
          fsTypes: buildList(dbusVolume.FsTypes?.v),
          fsType: dbusVolume.FsType?.v,
          snapshots: dbusVolume.Snapshots?.v,
          snapshotsConfigurable: dbusVolume.SnapshotsConfigurable?.v,
          snapshotsAffectSizes: dbusVolume.SnapshotsAffectSizes?.v,
          sizeRelevantVolumes: buildList(dbusVolume.SizeRelevantVolumes?.v)
        };
      };

      const buildAction = dbusAction => {
        return {
          text: dbusAction.Text.v,
          subvol: dbusAction.Subvol.v,
          delete: dbusAction.Delete.v
        };
      };

      return {
        candidateDevices: proxy.CandidateDevices,
        lvm: proxy.LVM,
        encryptionPassword: proxy.EncryptionPassword,
        volumes: proxy.Volumes.map(buildVolume),
        actions: proxy.Actions.map(buildAction)
      };
    };

    return buildResult(proxy);
  }

  /**
   * Calculates a new proposal
   *
   * @param {Settings} settings
   *
   * @typedef {object} Settings
   * @property {string[]} [candidateDevices] - Devices to use for the proposal
   * @property {string} [encryptionPassword] - Password for encrypting devices
   * @property {boolean} [lvm] - Whether to calculate the proposal with LVM volumes
   * @property {Volume[]} [volumes] - Volumes to create
   *
   * @returns {Promise<number>} 0 on success, 1 on failure
   */
  async calculate({ candidateDevices, encryptionPassword, lvm, volumes }) {
    const dbusVolume = (volume) => {
      return removeUndefinedCockpitProperties({
        MountPoint: { t: "s", v: volume.mountPoint },
        Encrypted: { t: "b", v: volume.encrypted },
        FsType: { t: "s", v: volume.fsType },
        MinSize: { t: "x", v: volume.minSize },
        MaxSize: { t: "x", v: volume.maxSize },
        FixedSizeLimits: { t: "b", v: volume.fixedSizeLimits },
        Snapshots: { t: "b", v: volume.snapshots }
      });
    };

    const settings = removeUndefinedCockpitProperties({
      CandidateDevices: { t: "as", v: candidateDevices },
      EncryptionPassword: { t: "s", v: encryptionPassword },
      LVM: { t: "b", v: lvm },
      Volumes: { t: "aa{sv}", v: volumes?.map(dbusVolume) }
    });

    return this.proxies.proposalCalculator.Calculate(settings);
  }

  /**
   * @private
   * Proxy for org.opensuse.DInstaller.Storage1.Proposal iface
   *
   * @note The proposal object implementing this iface is dynamically exported.
   *
   * @returns {Promise<object|null>} null if the proposal object is not exported yet
   */
  async proposalProxy() {
    try {
      return await this.client.proxy(PROPOSAL_IFACE);
    } catch {
      return null;
    }
  }
}

/**
 * Class providing an API for managing iSCSI through D-Bus
 */
class ISCSIManager {
  /**
   * @param {DBusClient} client
   */
  constructor(client) {
    this.client = client;
    this.proxies = {};
  }

  async setUp() {
    const iscsiInitiator = await this.client.proxy(ISCSI_INITIATOR_IFACE, STORAGE_OBJECT);
    const iscsiNodes = await this.client.proxies(ISCSI_NODE_IFACE, ISCSI_NODES_NAMESPACE);

    this.proxies = { iscsiInitiator, iscsiNodes };
  }

  async getInitiatorIbft() {
    return this.proxies.iscsiInitiator.IBFT;
  }

  /**
   * Gets the iSCSI initiator name
   *
   * @returns {Promise<string>}
   */
  async getInitiatorName() {
    return this.proxies.iscsiInitiator.InitiatorName;
  }

  /**
   * Sets the iSCSI initiator name
   *
   * @param {string} value
   */
  async setInitiatorName(value) {
    this.proxies.iscsiInitiator.InitiatorName = value;
  }

  /**
   * Gets the list of exported iSCSI nodes
   *
   * @returns {Promise<ISCSINode[]>}
   *
   * @typedef {object} ISCSINode
   * @property {string} id
   * @property {string} target
   * @property {string} address
   * @property {number} port
   * @property {string} interface
   * @property {boolean} ibft
   * @property {boolean} connected
   * @property {string} startup
   */
  async getNodes() {
    return Object.values(this.proxies.iscsiNodes).map(this.buildNode);
  }

  /**
   * Performs an iSCSI discovery
   *
   * @param {string} address - IP address of the iSCSI server
   * @param {number} port - Port of the iSCSI server
   * @param {DiscoverOptions} [options]
   *
   * @typedef {object} DiscoverOptions
   * @property {string} [username] - Username for authentication by target
   * @property {string} [password] - Password for authentication by target
   * @property {string} [reverseUsername] - Username for authentication by initiator
   * @property {string} [reversePassword] - Password for authentication by initiator
   *
   * @returns {Promise<number>} 0 on success, 1 on failure
   */
  async discover(address, port, options = {}) {
    const auth = removeUndefinedCockpitProperties({
      Username: { t: "s", v: options.username },
      Password: { t: "s", v: options.password },
      ReverseUsername: { t: "s", v: options.reverseUsername },
      ReversePassword: { t: "s", v: options.reversePassword }
    });

    return this.proxies.iscsiInitiator.Discover(address, port, auth);
  }

  /**
   * Sets the startup status of the connection
   *
   * @param {ISCSINode} node
   * @param {String} startup
   */
  async setStartup(node, startup) {
    const path = this.nodePath(node);

    const proxy = await this.client.proxy(ISCSI_NODE_IFACE, path);
    proxy.Startup = startup;
  }

  /**
   * Deletes the given iSCSI node
   *
   * @param {ISCSINode} node
   * @returns {Promise<number>} 0 on success, 1 on failure if the given path is not exported, 2 on
   *  failure because any other reason.
   */
  async delete(node) {
    const path = this.nodePath(node);

    return this.proxies.iscsiInitiator.Delete(path);
  }

  /**
   * Creates an iSCSI session
   *
   * @param {ISCSINode} node
   * @param {LoginOptions} options
   *
   * @typedef {object} LoginOptions
   * @property {string} [username] - Username for authentication by target
   * @property {string} [password] - Password for authentication by target
   * @property {string} [reverseUsername] - Username for authentication by initiator
   * @property {string} [reversePassword] - Password for authentication by initiator
   * @property {string} [startup] - Startup status for the session
   *
   * @returns {Promise<number>} 0 on success, 1 on failure if the given startup value is not
   *  valid, and 2 on failure because any other reason
   */
  async login(node, options = {}) {
    const path = this.nodePath(node);

    const dbusOptions = removeUndefinedCockpitProperties({
      Username: { t: "s", v: options.username },
      Password: { t: "s", v: options.password },
      ReverseUsername: { t: "s", v: options.reverseUsername },
      ReversePassword: { t: "s", v: options.reversePassword },
      Startup: { t: "s", v: options.startup }
    });

    const proxy = await this.client.proxy(ISCSI_NODE_IFACE, path);
    return proxy.Login(dbusOptions);
  }

  /**
   * Closes an iSCSI session
   *
   * @param {ISCSINode} node
   * @returns {Promise<number>} 0 on success, 1 on failure
   */
  async logout(node) {
    const path = this.nodePath(node);
    // const iscsiNode = new ISCSINodeObject(this.client, path);
    // return await iscsiNode.iface.logout();
    const proxy = await this.client.proxy(ISCSI_NODE_IFACE, path);
    return proxy.Logout();
  }

  onInitiatorChanged(handler) {
    return this.client.onObjectChanged(STORAGE_OBJECT, ISCSI_INITIATOR_IFACE, (changes) => {
      const data = {
        name: changes.InitiatorName?.v,
        ibft: changes.IBFT?.v
      };

      const filtered = Object.entries(data).filter(([, v]) => v !== undefined);
      return handler(Object.fromEntries(filtered));
    });
  }

  async onNodeAdded(handler) {
    this.proxies.iscsiNodes.addEventListener("added", (_, proxy) => handler(this.buildNode(proxy)));
  }

  async onNodeChanged(handler) {
    this.proxies.iscsiNodes.addEventListener("changed", (_, proxy) => handler(this.buildNode(proxy)));
  }

  async onNodeRemoved(handler) {
    this.proxies.iscsiNodes.addEventListener("removed", (_, proxy) => handler(this.buildNode(proxy)));
  }

  buildNode(proxy) {
    const id = path => path.split("/").slice(-1)[0];

    return {
      id: id(proxy.path),
      target: proxy.Target,
      address: proxy.Address,
      port: proxy.Port,
      interface: proxy.Interface,
      ibft: proxy.IBFT,
      connected: proxy.Connected,
      startup: proxy.Startup
    };
  }

  /**
   * @private
   * Builds the D-Bus path for the given iSCSI node
   *
   * @param {ISCSINode} node
   * @returns {string}
   */
  nodePath(node) {
    return ISCSI_NODES_NAMESPACE + "/" + node.id;
  }
}

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
    this.client = new DBusClient(SERVICE, address);
    this.proposal = new ProposalManager(this.client);
    this.iscsi = new ISCSIManager(this.client);
  }

  /**
   * Initializes the proxies
   */
  async setUp() {
    await this.proposal.setUp();
    await this.iscsi.setUp();
  }
}

/**
 * Allows interacting with the storage settings
 */
class StorageClient extends WithValidation(
  WithStatus(StorageBaseClient, STORAGE_OBJECT), STORAGE_OBJECT
) {}

export { StorageClient };
