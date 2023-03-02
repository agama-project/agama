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

/**
 * Base class for a D-Bus object proxy
 */
class DBusObject {
  /**
   * @param {DBusClient} client - D-Bus client which exports the object
   * @param {string} path - Path in which the D-Bus object is exported
   */
  constructor(client, path) {
    this.client = client;
    this.path = path;
  }
}

/**
 * Base class for a D-Bus interface proxy
 */
class DBusIface {
  /**
   * @param {string} name - Interface name
   * @param {DBusObject} object - D-Bus object implementing the interface
   */
  constructor(name, object) {
    this.name = name;
    this.object = object;
  }

  /**
   * Function that receives a D-Bus proxy
   *
   * @callback dbusCallback
   * @param {object} proxy
   */

  /**
   * Runs a callback
   *
   * @param {dbusCallback} callback
   * @returns {Promise} Represents the result of the callback
   */
  async run(callback) {
    if (!this.proxy)
      this.proxy = await this.object.client.proxy(this.name, this.object.path);

    return callback(this.proxy);
  }

  /**
   * Recursively removes cockpit type annotations
   *
   * @example
   * plainObject({ t: "s", v: "foo" })
   * // returns "foo"
   *
   * @example
   * plainObject({ test: { t: "s", v: "foo" }})
   * // returns { test: "foo" }
   *
   * @example
   * plainObject({
   *  test1: {
   *    bar: { t: "s", v: "foo" }
   *  },
   *  test2: "foobar",
   *  test3: [{ t: "b", v: true }]
   * })
   * // returns { test1: { bar: "foo"}, test2: "foobar" }, test3: [true] }
   *
   * @param {*} cockpitObject
   * @returns {*}
   */
  plainObject(cockpitObject) {
    if (typeof cockpitObject !== "object")
      return cockpitObject;

    if (Object.keys(cockpitObject).includes("v"))
      return cockpitObject.v;

    const result = {};
    Object.keys(cockpitObject).forEach(p => {
      const value = cockpitObject[p].v;

      if (Array.isArray(value))
        result[p] = value.map(v => this.plainObject(v));
      else if (typeof value === "object")
        result[p] = this.plainObject(value);
      else
        result[p] = value;
    });

    return result;
  }

  /**
   * Creates a cockpit object from a list of property definitions
   *
   * @example
   * cockpitObject([
   *  { name: Foo, type: "s", value: "bar" },
   *  { name: Valid, type: "b", value: true }
   * ])
   * // returns { Foo: { t: "s", v: "bar" }, Valid: { t: "b", v: true } }
   *
   * @param {cockpitProperty[]} properties
   *
   * @typedef {object} cockpitProperty
   * @property {string} name - Name of the property in the resulting cockpit object
   * @property {string} type - A D-Bus type managed by cockpit
   * @property {*} value - The value of this property in the resulting cockpit object

   * @returns {object} Cockpit object containing type annotations
   */
  cockpitObject(properties) {
    const result = {};

    properties.forEach(({ name, type, value }) => {
      if (value !== undefined)
        result[name] = cockpit.variant(type, value);
    });

    return result;
  }
}

class ObjectManagerIface extends DBusIface {
  static NAME = "org.freedesktop.DBus.ObjectManager";

  /**
   * @param {DBusObject} object - Object that implements the interface
   */
  constructor(object) {
    super(ObjectManagerIface.NAME, object);
  }

  /**
   * Gets the list of managed objects
   *
   * @returns {Promise<object[]>}
   */
  async getManagedObjects() {
    const dbusResult = await this.object.client.call(
      this.object.path, this.name, "GetManagedObjects", null);

    const buildObjects = (dbusObjects) => {
      return Object.keys(dbusObjects).map(path => {
        const ifacesAndProperties = {};
        Object.keys(dbusObjects[path]).forEach(iface => {
          ifacesAndProperties[iface] = this.plainObject(dbusObjects[path][iface]);
        });
        return { dbusPath: path, ...ifacesAndProperties };
      });
    };

    return buildObjects(dbusResult[0]);
  }
}

class StorageObject extends DBusObject {
  static PATH = "/org/opensuse/DInstaller/Storage1";

  static ISCSIInitiatorIface = class ISCSIInitiatorIface extends DBusIface {
    static NAME = "org.opensuse.DInstaller.Storage1.ISCSI.Initiator";

    /**
     * @param {StorageObject} object
     */
    constructor(object) {
      super(ISCSIInitiatorIface.NAME, object);
    }

    /**
     * Gets the iSCSI initiator name
     *
     * @returns {Promise<string>}
     */
    async getInitiatorName() {
      return await this.run(proxy => proxy.InitiatorName);
    }

    /**
     * Sets the iSCSI initiator name
     *
     * @param {string} value
     */
    async setInitiatorName(value) {
      await this.run(proxy => { proxy.InitiatorName = value });
    }

    /**
     * Performs an iSCSI discovery
     *
     * @param {string} address - IP address of the iSCSI server
     * @param {number} port - Port of the iSCSI server
     * @param {discoverOptions} [options]
     *
     * @typedef {object} discoverOptions
     * @property {string} [username] - Username for authentication by target
     * @property {string} [password] - Password for authentication by target
     * @property {string} [reverseUsername] - Username for authentication by initiator
     * @property {string} [reversePassword] - Password for authentication by initiator
     *
     * @returns {Promise<number>} 0 on success, 1 on failure
     */
    async discover(address, port, options = {}) {
      const auth = this.cockpitObject([
        { name: "Username", type: "s", value: options.username },
        { name: "Password", type: "s", value: options.password },
        { name: "ReverseUsername", type: "s", value: options.reverseUsername },
        { name: "ReversePassword", type: "s", value: options.reversePassword }
      ]);

      return await this.run(proxy => proxy.Discover(address, port, auth));
    }

    /**
     * Deletes the iSCSI node exported with the given path
     *
     * @param {string} path - D-Bus path of the node to delete
     * @returns {Promise<number>} 0 on success, 1 on failure if the given path is not exported, 2 on
     *  failure because any other reason.
     */
    async delete(path) {
      return await this.run(proxy => proxy.Delete(path));
    }
  };

  static ProposalCalculatorIface = class ProposalCalculatorIface extends DBusIface {
    static NAME = "org.opensuse.DInstaller.Storage1.Proposal.Calculator";

    /**
     * @param {StorageObject} object
     */
    constructor(object) {
      super(ProposalCalculatorIface.NAME, object);
    }

    /**
     * Gets the list of available devices for calculating a proposal
     *
     * @returns {Promise<availableDevice[]>}
     *
     * @typedef {[string, string]} availableDevice - Device name and label
     */
    async getAvailableDevices() {
      return await this.run(proxy => proxy.AvailableDevices);
    }

    /**
     * Calculates a new proposal
     *
     * @param {proposalSettings} settings
     *
     * @typedef {object} proposalSettings
     * @property {string[]} [candidateDevices] - Devices to use for the proposal
     * @property {string} [encryptionPassword] - Password for encrypting devices
     * @property {boolean} [lvm] - Whether to calculate the proposal with LVM volumes
     * @property {proposalVolume[]} [volumes] - Volumes to create
     *
     * @typedef {object} proposalVolume
     * @property {string} mountPoint
     * @property {boolean} encrypted
     * @property {string} fsType
     * @property {number} minSize
     * @property {number} maxSize
     * @property {boolean} fixedSizeLimits
     * @property {boolean} snapshots
     *
     * @returns {Promise<number>} 0 on success, 1 on failure
     */
    async calculate({ candidateDevices, encryptionPassword, lvm, volumes }) {
      const dbusVolume = (volume) => {
        return this.cockpitObject([
          { name: "MountPoint", type: "s", value: volume.mountPoint },
          { name: "Encrypted", type: "b", value: volume.encrypted },
          { name: "FsType", type: "s", value: volume.fsType },
          { name: "MinSize", type: "x", value: volume.minSize },
          { name: "MaxSize", type: "x", value: volume.maxSize },
          { name: "FixedSizeLimits", type: "b", value: volume.fixedSizeLimits },
          { name: "Snapshots", type: "b", value: volume.snapshots }
        ]);
      };

      const settings = this.cockpitObject([
        { name: "CandidateDevices", type: "as", value: candidateDevices },
        { name: "EncryptionPassword", type: "s", value: encryptionPassword },
        { name: "LVM", type: "b", value: lvm },
        { name: "Volumes", type: "aa{sv}", value: volumes?.map(dbusVolume) }
      ]);

      return this.run(proxy => proxy.Calculate(settings));
    }
  };

  /**
   * @param {DBusClient} client
   */
  constructor(client) {
    super(client, StorageObject.PATH);
    this.objectManager = new ObjectManagerIface(this);
    this.proposalCalculator = new StorageObject.ProposalCalculatorIface(this);
    this.iscsiInitiator = new StorageObject.ISCSIInitiatorIface(this);
  }
}

class ProposalObject extends DBusObject {
  static PATH = "/org/opensuse/DInstaller/Storage1/Proposal";

  static ProposalIface = class ProposalIface extends DBusIface {
    static NAME = "org.opensuse.DInstaller.Storage1.Proposal";

    /**
     * @param {ProposalObject} object
     */
    constructor(object) {
      super(ProposalIface.NAME, object);
    }
  };

  /**
   * @param {DBusClient} client
   */
  constructor(client) {
    super(client, ProposalObject.PATH);
  }
}

class ISCSINodeObject extends DBusObject {
  static ISCSINodeIface = class ISCSINodeIface extends DBusIface {
    static NAME = "org.opensuse.DInstaller.Storage1.ISCSI.Node";

    /**
     * @param {ISCSINodeObject} object
     */
    constructor(object) {
      super(ISCSINodeIface.NAME, object);
    }

    /**
     * Sets the startup status
     *
     * @param {string} value - Valid values are "onboot", "manual" and "automatic"
     */
    async setStartup(value) {
      await this.run(proxy => { proxy.Startup = value });
    }

    /**
     * Creates an iSCSI session
     *
     * @param {loginOptions} options
     *
     * @typedef {object} loginOptions
     * @property {string} [username] - Username for authentication by target
     * @property {string} [password] - Password for authentication by target
     * @property {string} [reverseUsername] - Username for authentication by initiator
     * @property {string} [reversePassword] - Password for authentication by initiator
     * @property {string} [startup] - Startup status for the session
     *
     * @returns {Promise<number>} 0 on success, 1 on failure if the given startup value is not
     *  valid, and 2 on failure because any other reason
     */
    async login(options = {}) {
      const dbusOptions = this.cockpitObject([
        { name: "Username", type: "s", value: options.username },
        { name: "Password", type: "s", value: options.password },
        { name: "ReverseUsername", type: "s", value: options.reverseUsername },
        { name: "ReversePassword", type: "s", value: options.reversePassword },
        { name: "Startup", type: "s", value: options.startup }
      ]);

      return await this.run(proxy => proxy.Login(dbusOptions));
    }

    /**
     * Closes the iSCSI session
     *
     * @returns {Promise<number>} 0 on success, 1 on failure
     */
    async logout() {
      return await this.run(proxy => proxy.Logout());
    }
  };

  /**
   * @param {DBusClient} client
   * @param {string} path - D-Bus path of the iSCSI node
   */
  constructor(client, path) {
    super(client, path);
    this.iface = new ISCSINodeObject.ISCSINodeIface(this);
  }
}

/**
 * Class providing an API for managing the storage proposal
 */
class ProposalManager {
  /**
   * @param {StorageObject} storage
   */
  constructor(storage) {
    this.storage = storage;
    this.client = storage.client;
  }

  /**
   * Gets data associated to the proposal
   *
   * @returns {Promise<proposalData>}
   *
   * @typedef {object} proposalData
   * @property {proposalAvailableDevice[]} availableDevices
   * @property {proposalResult} result
   */
  async getData() {
    const availableDevices = await this.getAvailableDevices();
    const result = await this.getResult();

    return { availableDevices, result };
  }

  /**
   * Gets the list of available devices
   *
   * @returns {Promise<proposalAvailableDevice[]>}
   *
   * @typedef {object} proposalAvailableDevice
   * @property {string} id - Device kernel name
   * @property {string} label - Device description
   */
  async getAvailableDevices() {
    const dbusDevices = await this.storage.proposalCalculator.getAvailableDevices();

    const buildDevice = dbusDevice => {
      return {
        id: dbusDevice[0],
        label: dbusDevice[1]
      };
    };

    return dbusDevices.map(buildDevice);
  }

  /**
   * Gets the values of the current proposal
   *
   * @return {Promise<proposalResult>}
   *
   * @typedef {object} proposalResult
   * @property {string[]} candidateDevices
   * @property {boolean} lvm
   * @property {string} encryptionPassword
   * @property {proposalVolume[]} volumes
   * @property {proposalAction[]} actions
   *
   * @typedef {object} proposalVolume
   * @property {string} deviceType
   * @property {boolean} optional
   * @property {string} mountPoint
   * @property {boolean} fixedSizeLimits
   * @property {number} minSize
   * @property {number} maxSize
   * @property {string[]} fsTypes
   * @property {string} fsType
   * @property {boolean} snapshots
   * @property {boolean} snapshotsConfigurable
   * @property {boolean} snapshotsAffectSizes
   * @property {string[]} sizeRelevantVolumes
   *
   * @typedef {object} proposalAction
   * @property {string} text
   * @property {boolean} subvol
   * @property {boolean} delete
  */
  async getResult() {
    const dbusObjects = await this.storage.objectManager.getManagedObjects();

    const dbusProposal = dbusObjects.find(o => o.dbusPath === ProposalObject.PATH);

    if (dbusProposal === undefined)
      return undefined;

    const buildResult = (dbusProposal) => {
      const properties = dbusProposal[ProposalObject.ProposalIface.NAME];

      const buildVolume = dbusVolume => {
        return {
          deviceType: dbusVolume.DeviceType,
          optional: dbusVolume.Optional,
          encrypted: dbusVolume.Encrypted,
          mountPoint: dbusVolume.MountPoint,
          fixedSizeLimits: dbusVolume.FixedSizeLimits,
          adaptiveSizes: dbusVolume.AdaptiveSizes,
          minSize: dbusVolume.MinSize,
          maxSize: dbusVolume.MaxSize,
          fsTypes: dbusVolume.FsTypes,
          fsType: dbusVolume.FsType,
          snapshots: dbusVolume.Snapshots,
          snapshotsConfigurable: dbusVolume.SnapshotsConfigurable,
          snapshotsAffectSizes: dbusVolume.SnapshotsAffectSizes,
          sizeRelevantVolumes: dbusVolume.SizeRelevantVolumes
        };
      };

      const buildAction = dbusAction => {
        return {
          text: dbusAction.Text,
          subvol: dbusAction.Subvol,
          delete: dbusAction.Delete
        };
      };

      return {
        candidateDevices: properties.CandidateDevices,
        lvm: properties.LVM,
        encryptionPassword: properties.EncryptionPassword,
        volumes: properties.Volumes.map(buildVolume),
        actions: properties.Actions.map(buildAction)
      };
    };

    return buildResult(dbusProposal);
  }

  /**
   * @see {@link StorageObject.ProposalCalculatorIface }
   */
  async calculate(settings = {}) {
    return await this.storage.proposalCalculator.calculate(settings);
  }
}

/**
 * Class providing an API for managing iSCSI
 */
class ISCSIManager {
  /**
   * @param {StorageObject} storage
   */
  constructor(storage) {
    this.storage = storage;
    this.client = storage.client;
    this.iscsiNodesPath = storage.path + "/iscsi_nodes";
  }

  /**
   * @see {@link StorageObject.ISCSIInitiatorIface }
   */
  async getInitiatorName() {
    return await this.storage.iscsiInitiator.getInitiatorName();
  }

  /**
   * @see {@link StorageObject.ISCSIInitiatorIface }
   */
  async setInitiatorName(value) {
    await this.storage.iscsiInitiator.setInitiatorName(value);
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
    const dbusObjects = await this.storage.objectManager.getManagedObjects();

    const iscsiObjects = dbusObjects.filter(o => o.dbusPath.startsWith(this.iscsiNodesPath));

    const buildNode = (dbusNode) => {
      const properties = dbusNode[ISCSINodeObject.ISCSINodeIface.NAME];

      return {
        id: this.nodeId(dbusNode.dbusPath),
        target: properties.Target,
        address: properties.Address,
        port: properties.Port,
        interface: properties.Interface,
        ibft: properties.IBFT,
        connected: properties.Connected,
        startup: properties.Startup
      };
    };

    return iscsiObjects.map(o => buildNode(o));
  }

  /**
   * @see {@link StorageObject.ISCSIInitiatorIface }
   */
  async discover(address, port, options = {}) {
    return await this.storage.iscsiInitiator.discover(address, port, options);
  }

  /**
   * @see {@link StorageObject.ISCSIInitiatorIface }
   * @param {ISCSINode} node
   */
  async delete(node) {
    const path = this.nodePath(node);
    return await this.storage.iscsiInitiator.delete(path);
  }

  /**
   * @see {@link StorageObject.ISCSIInitiatorIface }
   * @param {ISCSINode} node
   */
  async login(node, options = {}) {
    const path = this.nodePath(node);
    const iscsiNode = new ISCSINodeObject(this.client, path);

    return await iscsiNode.iface.login(options);
  }

  /**
   * @see {@link StorageObject.ISCSIInitiatorIface }
   * @param {ISCSINode} node
   */
  async logout(node) {
    const path = this.nodePath(node);
    const iscsiNode = new ISCSINodeObject(this.client, path);

    return await iscsiNode.iface.logout();
  }

  /**
   * Gets the id of the node from its D-Bus path
   *
   * @param {string} path
   * @returns {string}
   */
  nodeId(path) {
    return path.split("/").slice(-1)[0];
  }

  /**
   * Builds the D-Bus path for the given iSCSI node
   *
   * @param {ISCSINode} node
   * @returns {string}
   */
  nodePath(node) {
    return this.iscsiNodesPath + "/" + node.id;
  }
}

/**
 * Storage base client
 *
 * @ignore
 */
class StorageBaseClient {
  static SERVICE = "org.opensuse.DInstaller.Storage";

  /**
   * @param {string|undefined} address - D-Bus address; if it is undefined, it uses the system bus.
   */
  constructor(address = undefined) {
    this.client = new DBusClient(StorageBaseClient.SERVICE, address);

    const storage = new StorageObject(this.client);
    this.proposal = new ProposalManager(storage);
    this.iscsi = new ISCSIManager(storage);
  }
}

/**
 * Allows interacting with the storage settings
 */
class StorageClient extends WithValidation(
  WithStatus(StorageBaseClient, StorageObject.PATH), StorageObject.PATH
) {}

export { StorageClient };
