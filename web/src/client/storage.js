/*
 * Copyright (c) [2022-2024] SUSE LLC
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
// cspell:ignore ptable

import DBusClient from "./dbus";
import { WithIssues, WithStatus, WithProgress } from "./mixins";
import { hex } from "~/utils";

const STORAGE_OBJECT = "/org/opensuse/Agama/Storage1";
const STORAGE_IFACE = "org.opensuse.Agama.Storage1";
const STORAGE_JOBS_NAMESPACE = "/org/opensuse/Agama/Storage1/jobs";
const STORAGE_JOB_IFACE = "org.opensuse.Agama.Storage1.Job";
const STORAGE_SYSTEM_NAMESPACE = "/org/opensuse/Agama/Storage1/system";
const STORAGE_STAGING_NAMESPACE = "/org/opensuse/Agama/Storage1/staging";
const PROPOSAL_IFACE = "org.opensuse.Agama.Storage1.Proposal";
const PROPOSAL_CALCULATOR_IFACE = "org.opensuse.Agama.Storage1.Proposal.Calculator";
const ISCSI_INITIATOR_IFACE = "org.opensuse.Agama.Storage1.ISCSI.Initiator";
const ISCSI_NODES_NAMESPACE = "/org/opensuse/Agama/Storage1/iscsi_nodes";
const ISCSI_NODE_IFACE = "org.opensuse.Agama.Storage1.ISCSI.Node";
const DASD_MANAGER_IFACE = "org.opensuse.Agama.Storage1.DASD.Manager";
const DASD_DEVICES_NAMESPACE = "/org/opensuse/Agama/Storage1/dasds";
const DASD_DEVICE_IFACE = "org.opensuse.Agama.Storage1.DASD.Device";
const DASD_STATUS_IFACE = "org.opensuse.Agama.Storage1.DASD.Format";
const ZFCP_MANAGER_IFACE = "org.opensuse.Agama.Storage1.ZFCP.Manager";
const ZFCP_CONTROLLERS_NAMESPACE = "/org/opensuse/Agama/Storage1/zfcp_controllers";
const ZFCP_CONTROLLER_IFACE = "org.opensuse.Agama.Storage1.ZFCP.Controller";
const ZFCP_DISKS_NAMESPACE = "/org/opensuse/Agama/Storage1/zfcp_disks";
const ZFCP_DISK_IFACE = "org.opensuse.Agama.Storage1.ZFCP.Disk";

/**
 * Enum for the encryption method values
 *
 * @readonly
 * @enum { string }
 */
const EncryptionMethods = Object.freeze({
  LUKS2: "luks2",
  TPM: "tpm_fde"
});

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
 * Gets the basename of a D-Bus path
 *
 * @example
 * dbusBasename("/org/opensuse/Agama/Storage1/object1");
 * //returns "object1"
 *
 * @param {string} path
 * @returns {string}
 */
const dbusBasename = (path) => path.split("/").slice(-1)[0];

/**
 * Class providing an API for managing a devices tree through D-Bus
 */
class DevicesManager {
  /**
   * @param {DBusClient} client
   * @param {string} rootPath - Root path of the devices tree
   */
  constructor(client, rootPath) {
    this.client = client;
    this.rootPath = rootPath;
  }

  /**
   * Gets all the exported devices
   *
   * @returns {Promise<StorageDevice[]>}
   *
   * @typedef {object} StorageDevice
   * @property {string} sid - Storage ID
   * @property {string} name - Device name
   * @property {string} description - Device description
   * @property {boolean} isDrive - Whether the device is a drive
   * @property {string} type - Type of device (e.g., "disk", "raid", "multipath", "dasd", "md")
   * @property {string} [vendor]
   * @property {string} [model]
   * @property {string[]} [driver]
   * @property {string} [bus]
   * @property {string} [busId] - DASD Bus ID (only for "dasd" type)
   * @property {string} [transport]
   * @property {boolean} [sdCard]
   * @property {boolean} [dellBOOS]
   * @property {string[]} [devices] - RAID devices (only for "raid" and "md" types)
   * @property {string[]} [wires] - Multipath wires (only for "multipath" type)
   * @property {string} [level] - MD RAID level (only for "md" type)
   * @property {string} [uuid]
   * @property {number} [start] - First block of the region (only for block devices)
   * @property {boolean} [active]
   * @property {boolean} [encrypted] - Whether the device is encrypted (only for block devices)
   * @property {boolean} [isEFI] - Whether the device is an EFI partition (only for partition)
   * @property {number} [size]
   * @property {number} [recoverableSize]
   * @property {string[]} [systems] - Name of the installed systems
   * @property {string[]} [udevIds]
   * @property {string[]} [udevPaths]
   * @property {PartitionTable} [partitionTable]
   * @property {Filesystem} [filesystem]
   * @property {Component} [component] - When it is used as component of other devices
   * @property {StorageDevice[]} [physicalVolumes] - Only for LVM VGs
   * @property {StorageDevice[]} [logicalVolumes] - Only for LVM VGs
   *
   * @typedef {object} PartitionTable
   * @property {string} type
   * @property {StorageDevice[]} partitions
   * @property {PartitionSlot[]} unusedSlots
   * @property {number} unpartitionedSize - Total size not assigned to any partition
   *
   * @typedef {object} PartitionSlot
   * @property {number} start
   * @property {number} size
   *
   * @typedef {object} Component
   * @property {string} type
   * @property {string[]} deviceNames
   *
   * @typedef {object} Filesystem
   * @property {string} type
   * @property {string} [mountPath]
   */
  async getDevices() {
    const buildDevice = (path, dbusDevices) => {
      const addDeviceProperties = (device, dbusProperties) => {
        device.sid = dbusProperties.SID.v;
        device.name = dbusProperties.Name.v;
        device.description = dbusProperties.Description.v;
      };

      const addDriveProperties = (device, dbusProperties) => {
        device.isDrive = true;
        device.type = dbusProperties.Type.v;
        device.vendor = dbusProperties.Vendor.v;
        device.model = dbusProperties.Model.v;
        device.driver = dbusProperties.Driver.v;
        device.bus = dbusProperties.Bus.v;
        device.busId = dbusProperties.BusId.v;
        device.transport = dbusProperties.Transport.v;
        device.sdCard = dbusProperties.Info.v.SDCard.v;
        device.dellBOSS = dbusProperties.Info.v.DellBOSS.v;
      };

      const addRAIDProperties = (device, raidProperties) => {
        device.devices = raidProperties.Devices.v.map(d => buildDevice(d, dbusDevices));
      };

      const addMultipathProperties = (device, multipathProperties) => {
        device.wires = multipathProperties.Wires.v.map(d => buildDevice(d, dbusDevices));
      };

      const addMDProperties = (device, mdProperties) => {
        device.type = "md";
        device.level = mdProperties.Level.v;
        device.uuid = mdProperties.UUID.v;
        device.devices = mdProperties.Devices.v.map(d => buildDevice(d, dbusDevices));
      };

      const addBlockProperties = (device, blockProperties) => {
        device.active = blockProperties.Active.v;
        device.encrypted = blockProperties.Encrypted.v;
        device.start = blockProperties.Start.v;
        device.size = blockProperties.Size.v;
        device.recoverableSize = blockProperties.RecoverableSize.v;
        device.systems = blockProperties.Systems.v;
        device.udevIds = blockProperties.UdevIds.v;
        device.udevPaths = blockProperties.UdevPaths.v;
      };

      const addPartitionProperties = (device, partitionProperties) => {
        device.type = "partition";
        device.isEFI = partitionProperties.EFI.v;
      };

      const addLvmVgProperties = (device, lvmVgProperties) => {
        device.type = "lvmVg";
        device.size = lvmVgProperties.Size.v;
        device.physicalVolumes = lvmVgProperties.PhysicalVolumes.v.map(d => buildDevice(d, dbusDevices));
        device.logicalVolumes = lvmVgProperties.LogicalVolumes.v.map(d => buildDevice(d, dbusDevices));
      };

      const addLvmLvProperties = (device) => {
        device.type = "lvmLv";
      };

      const addPtableProperties = (device, ptableProperties) => {
        const buildPartitionSlot = ([start, size]) => ({ start, size });
        const partitions = ptableProperties.Partitions.v.map(p => buildDevice(p, dbusDevices));
        device.partitionTable = {
          type: ptableProperties.Type.v,
          partitions,
          unpartitionedSize: device.size - partitions.reduce((s, p) => s + p.size, 0),
          unusedSlots: ptableProperties.UnusedSlots.v.map(buildPartitionSlot)
        };
      };

      const addFilesystemProperties = (device, filesystemProperties) => {
        const buildMountPath = path => path.length > 0 ? path : undefined;
        const buildLabel = label => label.length > 0 ? label : undefined;
        device.filesystem = {
          sid: filesystemProperties.SID.v,
          type: filesystemProperties.Type.v,
          mountPath: buildMountPath(filesystemProperties.MountPath.v),
          label: buildLabel(filesystemProperties.Label.v)
        };
      };

      const addComponentProperties = (device, componentProperties) => {
        device.component = {
          type: componentProperties.Type.v,
          deviceNames: componentProperties.DeviceNames.v
        };
      };

      const device = {
        sid: path.split("/").pop(),
        name: "",
        description: "",
        isDrive: false,
        type: ""
      };

      const dbusDevice = dbusDevices[path];
      if (!dbusDevice) return device;

      const deviceProperties = dbusDevice["org.opensuse.Agama.Storage1.Device"];
      if (deviceProperties !== undefined) addDeviceProperties(device, deviceProperties);

      const driveProperties = dbusDevice["org.opensuse.Agama.Storage1.Drive"];
      if (driveProperties !== undefined) addDriveProperties(device, driveProperties);

      const raidProperties = dbusDevice["org.opensuse.Agama.Storage1.RAID"];
      if (raidProperties !== undefined) addRAIDProperties(device, raidProperties);

      const multipathProperties = dbusDevice["org.opensuse.Agama.Storage1.Multipath"];
      if (multipathProperties !== undefined) addMultipathProperties(device, multipathProperties);

      const mdProperties = dbusDevice["org.opensuse.Agama.Storage1.MD"];
      if (mdProperties !== undefined) addMDProperties(device, mdProperties);

      const blockProperties = dbusDevice["org.opensuse.Agama.Storage1.Block"];
      if (blockProperties !== undefined) addBlockProperties(device, blockProperties);

      const partitionProperties = dbusDevice["org.opensuse.Agama.Storage1.Partition"];
      if (partitionProperties !== undefined) addPartitionProperties(device, partitionProperties);

      const lvmVgProperties = dbusDevice["org.opensuse.Agama.Storage1.LVM.VolumeGroup"];
      if (lvmVgProperties !== undefined) addLvmVgProperties(device, lvmVgProperties);

      const lvmLvProperties = dbusDevice["org.opensuse.Agama.Storage1.LVM.LogicalVolume"];
      if (lvmLvProperties !== undefined) addLvmLvProperties(device);

      const ptableProperties = dbusDevice["org.opensuse.Agama.Storage1.PartitionTable"];
      if (ptableProperties !== undefined) addPtableProperties(device, ptableProperties);

      const filesystemProperties = dbusDevice["org.opensuse.Agama.Storage1.Filesystem"];
      if (filesystemProperties !== undefined) addFilesystemProperties(device, filesystemProperties);

      const componentProperties = dbusDevice["org.opensuse.Agama.Storage1.Component"];
      if (componentProperties !== undefined) addComponentProperties(device, componentProperties);

      return device;
    };

    const managedObjects = await this.client.call(
      STORAGE_OBJECT,
      "org.freedesktop.DBus.ObjectManager",
      "GetManagedObjects",
      null
    );

    const dbusObjects = managedObjects.shift();
    const systemPaths = Object.keys(dbusObjects).filter(k => k.startsWith(this.rootPath));

    return systemPaths.map(p => buildDevice(p, dbusObjects));
  }
}

/**
 * Class providing an API for managing the storage proposal through D-Bus
 */
class ProposalManager {
  /**
   * @param {DBusClient} client
   * @param {DevicesManager} system
   */
  constructor(client, system) {
    this.client = client;
    this.system = system;
    this.proxies = {
      proposalCalculator: this.client.proxy(PROPOSAL_CALCULATOR_IFACE, STORAGE_OBJECT)
    };
  }

  /**
   * @typedef {object} ProposalSettings
   * @property {string} bootDevice
   * @property {string} encryptionPassword
   * @property {string} encryptionMethod
   * @property {boolean} lvm
   * @property {string} spacePolicy
   * @property {SpaceAction[]} spaceActions
   * @property {string[]} systemVGDevices
   * @property {Volume[]} volumes
   * @property {StorageDevice[]} installationDevices
   *
   * @typedef {object} SpaceAction
   * @property {string} device
   * @property {string} action
   *
   * @typedef {object} Volume
   * @property {string} mountPath
   * @property {string} fsType
   * @property {number} minSize
   * @property {number} [maxSize]
   * @property {boolean} autoSize
   * @property {boolean} snapshots
   * @property {boolean} transactional
   * @property {VolumeOutline} outline
   *
   * @typedef {object} VolumeOutline
   * @property {boolean} required
   * @property {string[]} fsTypes
   * @property {boolean} supportAutoSize
   * @property {boolean} adjustByRam
   * @property {boolean} snapshotsConfigurable
   * @property {boolean} snapshotsAffectSizes
   * @property {string[]} sizeRelevantVolumes
   */

  /**
   * Gets the list of available devices
   *
   * @returns {Promise<StorageDevice[]>}
   */
  async getAvailableDevices() {
    const findDevice = (devices, path) => {
      const sid = path.split("/").pop();
      const device = devices.find(d => d.sid === Number(sid));

      if (device === undefined) console.log("D-Bus object not found: ", path);

      return device;
    };

    const systemDevices = await this.system.getDevices();

    const proxy = await this.proxies.proposalCalculator;
    return proxy.AvailableDevices.map(path => findDevice(systemDevices, path)).filter(d => d);
  }

  /**
   * Gets the list of meaningful mount points for the selected product
   *
   * @returns {Promise<string[]>}
   */
  async getProductMountPoints() {
    const proxy = await this.proxies.proposalCalculator;
    return proxy.ProductMountPoints;
  }

  /**
   * Gets the list of encryption methods accepted by the proposal
   *
   * @returns {Promise<string[]>}
   */
  async getEncryptionMethods() {
    const proxy = await this.proxies.proposalCalculator;
    return proxy.EncryptionMethods;
  }

  /**
   * Obtains the default volume for the given mount path
   *
   * @param {string} mountPath
   * @returns {Promise<Volume>}
   */
  async defaultVolume(mountPath) {
    const proxy = await this.proxies.proposalCalculator;
    return this.buildVolume(await proxy.DefaultVolume(mountPath));
  }

  /**
   * Gets the values of the current proposal
   *
   * @return {Promise<ProposalResult|undefined>}
   *
   * @typedef {object} ProposalResult
   * @property {ProposalSettings} settings
   * @property {Action[]} actions
   *
   * @typedef {object} Action
   * @property {number} device
   * @property {string} text
   * @property {boolean} subvol
   * @property {boolean} delete
  */
  async getResult() {
    const proxy = await this.proposalProxy();

    if (!proxy) return undefined;

    const systemDevices = await this.system.getDevices();

    const buildResult = (proxy) => {
      const buildSpaceAction = dbusSpaceAction => {
        return {
          device: dbusSpaceAction.Device.v,
          action: dbusSpaceAction.Action.v
        };
      };

      const buildAction = dbusAction => {
        return {
          device: dbusAction.Device.v,
          text: dbusAction.Text.v,
          subvol: dbusAction.Subvol.v,
          delete: dbusAction.Delete.v
        };
      };

      const buildInstallationDevices = (proxy, devices) => {
        const findDevice = (devices, name) => {
          const device = devices.find(d => d.name === name);

          if (device === undefined) console.log("D-Bus object not found: ", name);

          return device;
        };

        const names = proxy.SystemVGDevices.filter(n => n !== proxy.BootDevice).concat([proxy.BootDevice]);
        // #findDevice returns undefined if no device is found with the given name.
        return names.map(dev => findDevice(devices, dev)).filter(dev => dev !== undefined);
      };

      return {
        settings: {
          bootDevice: proxy.BootDevice,
          lvm: proxy.LVM,
          spacePolicy: proxy.SpacePolicy,
          spaceActions: proxy.SpaceActions.map(buildSpaceAction),
          systemVGDevices: proxy.SystemVGDevices,
          encryptionPassword: proxy.EncryptionPassword,
          encryptionMethod: proxy.EncryptionMethod,
          volumes: proxy.Volumes.map(this.buildVolume),
          // NOTE: strictly speaking, installation devices does not belong to the settings. It
          // should be a separate method instead of an attribute in the settings object.
          // Nevertheless, it was added here for simplicity and to avoid passing more props in some
          // react components. Please, do not use settings as a jumble.
          installationDevices: buildInstallationDevices(proxy, systemDevices)
        },
        actions: proxy.Actions.map(buildAction)
      };
    };

    return buildResult(proxy);
  }

  /**
   * Calculates a new proposal
   *
   * @param {ProposalSettings} settings
   * @returns {Promise<number>} 0 on success, 1 on failure
   */
  async calculate(settings) {
    const {
      bootDevice,
      encryptionPassword,
      encryptionMethod,
      lvm,
      spacePolicy,
      spaceActions,
      systemVGDevices,
      volumes
    } = settings;

    const dbusSpaceActions = () => {
      const dbusSpaceAction = (spaceAction) => {
        return {
          Device: { t: "s", v: spaceAction.device },
          Action: { t: "s", v: spaceAction.action }
        };
      };

      if (spacePolicy !== "custom") return;

      return spaceActions?.map(dbusSpaceAction);
    };

    const dbusVolume = (volume) => {
      return removeUndefinedCockpitProperties({
        MountPath: { t: "s", v: volume.mountPath },
        FsType: { t: "s", v: volume.fsType },
        MinSize: { t: "t", v: volume.minSize },
        MaxSize: { t: "t", v: volume.maxSize },
        AutoSize: { t: "b", v: volume.autoSize },
        Snapshots: { t: "b", v: volume.snapshots },
        Transactional: { t: "b", v: volume.transactional },
      });
    };

    const dbusSettings = removeUndefinedCockpitProperties({
      BootDevice: { t: "s", v: bootDevice },
      EncryptionPassword: { t: "s", v: encryptionPassword },
      EncryptionMethod: { t: "s", v: encryptionMethod },
      LVM: { t: "b", v: lvm },
      SpacePolicy: { t: "s", v: spacePolicy },
      SpaceActions: { t: "aa{sv}", v: dbusSpaceActions() },
      SystemVGDevices: { t: "as", v: systemVGDevices },
      Volumes: { t: "aa{sv}", v: volumes?.map(dbusVolume) }
    });

    const proxy = await this.proxies.proposalCalculator;
    return proxy.Calculate(dbusSettings);
  }

  /**
   * @private
   * Builds a volume from the D-Bus data
   *
   * @param {DBusVolume} dbusVolume
   *
   * @typedef {Object} DBusVolume
   * @property {CockpitString} MountPath
   * @property {CockpitString} FsType
   * @property {CockpitNumber} MinSize
   * @property {CockpitNumber} [MaxSize]
   * @property {CockpitBoolean} AutoSize
   * @property {CockpitBoolean} Snapshots
   * @property {CockpitBoolean} Transactional
   * @property {CockpitVolumeOutline} Outline
   *
   * @typedef {Object} DBusVolumeOutline
   * @property {CockpitBoolean} Required
   * @property {CockpitAString} FsTypes
   * @property {CockpitBoolean} SupportAutoSize
   * @property {CockpitBoolean} SnapshotsConfigurable
   * @property {CockpitBoolean} SnapshotsAffectSizes
   * @property {CockpitAString} SizeRelevantVolumes
   *
   * @typedef {Object} CockpitString
   * @property {string} t - variant type
   * @property {string} v - value
   *
   * @typedef {Object} CockpitBoolean
   * @property {string} t - variant type
   * @property {boolean} v - value
   *
   * @typedef {Object} CockpitNumber
   * @property {string} t - variant type
   * @property {Number} v - value
   *
   * @typedef {Object} CockpitAString
   * @property {string} t - variant type
   * @property {string[]} v - value
   *
   * @typedef {Object} CockpitVolumeOutline
   * @property {string} t - variant type
   * @property {DBusVolumeOutline} v - value
   *
   * @returns {Volume}
   */
  buildVolume(dbusVolume) {
    const buildOutline = (dbusOutline) => {
      if (dbusOutline === undefined) return null;

      return {
        required: dbusOutline.Required.v,
        fsTypes: dbusOutline.FsTypes.v.map(val => val.v),
        supportAutoSize: dbusOutline.SupportAutoSize.v,
        adjustByRam: dbusOutline.AdjustByRam.v,
        snapshotsConfigurable: dbusOutline.SnapshotsConfigurable.v,
        snapshotsAffectSizes: dbusOutline.SnapshotsAffectSizes.v,
        sizeRelevantVolumes: dbusOutline.SizeRelevantVolumes.v.map(val => val.v)
      };
    };

    return {
      mountPath: dbusVolume.MountPath.v,
      fsType: dbusVolume.FsType.v,
      minSize: dbusVolume.MinSize.v,
      maxSize: dbusVolume.MaxSize?.v,
      autoSize: dbusVolume.AutoSize.v,
      snapshots: dbusVolume.Snapshots.v,
      transactional: dbusVolume.Transactional.v,
      outline: buildOutline(dbusVolume.Outline.v)
    };
  }

  /**
   * @private
   * Proxy for org.opensuse.Agama.Storage1.Proposal iface
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
 * Class providing an API for managing Direct Access Storage Devices (DASDs)
 */
class DASDManager {
  /**
   * @param {string} service - D-Bus service name
   * @param {string} address - D-Bus address
   */
  constructor(service, address) {
    this.service = service;
    this.address = address;
    this.proxies = {};
  }

  /**
   * @return {DBusClient} client
   */
  client() {
    // return this.assigned_client;
    if (!this._client) {
      this._client = new DBusClient(this.service, this.address);
    }

    return this._client;
  }

  // FIXME: use info from ObjectManager instead.
  //   https://github.com/openSUSE/Agama/pull/501#discussion_r1147707515
  async isSupported() {
    const proxy = await this.managerProxy();

    return proxy !== undefined;
  }

  /**
   * Build a job
   *
   * @returns {StorageJob}
   *
   * @typedef {object} StorageJob
   * @property {string} path
   * @property {boolean} running
   * @property {number} exitCode
   */
  buildJob(job) {
    return {
      path: job.path,
      running: job.Running,
      exitCode: job.ExitCode
    };
  }

  /**
   * Triggers a DASD probing
   */
  async probe() {
    const proxy = await this.managerProxy();
    await proxy?.Probe();
  }

  /**
   * Gets the list of DASD devices
   *
   * @returns {Promise<DASDDevice[]>}
   */
  async getDevices() {
    // FIXME: should we do the probing here?
    await this.probe();
    const devices = await this.devicesProxy();
    return Object.values(devices).map(this.buildDevice);
  }

  /**
   * Requests the format action for given devices
   *
   * @param {DASDDevice[]} devices
   */
  async format(devices) {
    const proxy = await this.managerProxy();
    const devicesPath = devices.map(d => this.devicePath(d));
    proxy.Format(devicesPath);
  }

  /**
   * Set DIAG for given devices
   *
   * @param {DASDDevice[]} devices
   * @param {boolean} value
   */
  async setDIAG(devices, value) {
    const proxy = await this.managerProxy();
    const devicesPath = devices.map(d => this.devicePath(d));
    proxy.SetDiag(devicesPath, value);
  }

  /**
   * Enables given DASD devices
   *
   * @param {DASDDevice[]} devices
   */
  async enableDevices(devices) {
    const proxy = await this.managerProxy();
    const devicesPath = devices.map(d => this.devicePath(d));
    proxy.Enable(devicesPath);
  }

  /**
   * Disables given DASD devices
   *
   * @param {DASDDevice[]} devices
   */
  async disableDevices(devices) {
    const proxy = await this.managerProxy();
    const devicesPath = devices.map(d => this.devicePath(d));
    proxy.Disable(devicesPath);
  }

  /**
   * @private
   * Proxy for objects implementing org.opensuse.Agama.Storage1.Job iface
   *
   * @note The jobs are dynamically exported.
   *
   * @returns {Promise<object>}
   */
  async jobsProxy() {
    if (!this.proxies.jobs)
      this.proxies.jobs = await this.client().proxies(STORAGE_JOB_IFACE, STORAGE_JOBS_NAMESPACE);

    return this.proxies.jobs;
  }

  async getJobs() {
    const proxy = await this.jobsProxy();
    return Object.values(proxy).filter(p => p.Running)
      .map(this.buildJob);
  }

  async onJobAdded(handler) {
    const proxy = await this.jobsProxy();
    proxy.addEventListener("added", (_, proxy) => handler(this.buildJob(proxy)));
  }

  async onJobChanged(handler) {
    const proxy = await this.jobsProxy();
    proxy.addEventListener("changed", (_, proxy) => handler(this.buildJob(proxy)));
  }

  /**
   * @private
   * Proxy for objects implementing org.opensuse.Agama.Storage1.Job iface
   *
   * @note The jobs are dynamically exported.
   *
   * @returns {Promise<object>}
   */
  async formatProxy(jobPath) {
    const proxy = await this.client().proxy(DASD_STATUS_IFACE, jobPath);
    return proxy;
  }

  async onFormatProgress(jobPath, handler) {
    const proxy = await this.formatProxy(jobPath);
    proxy.addEventListener("changed", (_, proxy) => {
      handler(proxy.Summary);
    });
  }

  /**
   * @private
   * Proxy for objects implementing org.opensuse.Agama.Storage1.DASD.Device iface
   *
   * @note The DASD devices are dynamically exported.
   *
   * @returns {Promise<object>}
   */
  async devicesProxy() {
    if (!this.proxies.devices)
      this.proxies.devices = await this.client().proxies(DASD_DEVICE_IFACE, DASD_DEVICES_NAMESPACE);

    return this.proxies.devices;
  }

  /**
   * @private
   * Proxy for org.opensuse.Agama.Storage1.DASD.Manager iface
   *
   * @returns {Promise<object>}
   */
  async managerProxy() {
    if (!this.proxies.dasdManager)
      this.proxies.dasdManager = await this.client().proxy(DASD_MANAGER_IFACE, STORAGE_OBJECT);

    return this.proxies.dasdManager;
  }

  async deviceEventListener(signal, handler) {
    const proxy = await this.devicesProxy();
    const action = (_, proxy) => handler(this.buildDevice(proxy));

    proxy.addEventListener(signal, action);
    return () => proxy.removeEventListener(signal, action);
  }

  /**
   * Build a list of DASD devices
   *
   * @returns {DASDDevice}
   *
   * @typedef {object} DASDDevice
   * @property {string} id
   * @property {number} hexId
   * @property {string} accessType
   * @property {string} channelId
   * @property {boolean} diag
   * @property {boolean} enabled
   * @property {boolean} formatted
   * @property {string} name
   * @property {string} partitionInfo
   * @property {string} status
   * @property {string} type
   */
  buildDevice(device) {
    const id = device.path.split("/").slice(-1)[0];
    const enabled = device.Enabled;

    return {
      id,
      accessType: enabled ? device.AccessType : "offline",
      channelId: device.Id,
      diag: device.Diag,
      enabled,
      formatted: device.Formatted,
      hexId: hex(device.Id),
      name: device.DeviceName,
      partitionInfo: enabled ? device.PartitionInfo : "",
      status: device.Status,
      type: device.Type
    };
  }

  /**
   * @private
   * Builds the D-Bus path for the given DASD device
   *
   * @param {DASDDevice} device
   * @returns {string}
   */
  devicePath(device) {
    return DASD_DEVICES_NAMESPACE + "/" + device.id;
  }
}

/**
 * Class providing an API for managing zFCP through D-Bus
 */
class ZFCPManager {
  /**
   * @param {string} service - D-Bus service name
   * @param {string} address - D-Bus address
   */
  constructor(service, address) {
    this.service = service;
    this.address = address;
    this.proxies = {};
  }

  /**
   * @return {DBusClient} client
   */
  client() {
    if (!this._client) {
      this._client = new DBusClient(this.service, this.address);
    }

    return this._client;
  }

  /**
   * Whether zFCP is supported
   *
   * @todo Use info from ObjectManager instead, see
   *  https://github.com/openSUSE/Agama/pull/501#discussion_r1147707515
   *
   * @returns {Promise<Boolean>}
   */
  async isSupported() {
    const proxy = await this.managerProxy();
    return proxy !== undefined;
  }

  /**
   * Whether allow_lun_scan option is active
   *
   * @returns {Promise<boolean|undefined>}
   */
  async getAllowLUNScan() {
    const proxy = await this.managerProxy();
    return proxy?.AllowLUNScan;
  }

  /**
   * Probes the zFCP devices
   *
   * @returns {Promise<void|undefined>}
   */
  async probe() {
    const proxy = await this.managerProxy();
    return proxy?.Probe();
  }

  /**
   * Gets the list of probed zFCP controllers
   *
   * @returns {Promise<ZFCPController[]>}
   */
  async getControllers() {
    const proxy = await this.controllersProxy();
    return Object.values(proxy).map(this.buildController);
  }

  /**
   * Gets the list of probed zFCP controllers
   *
   * @returns {Promise<ZFCPDisk[]>}
   */
  async getDisks() {
    const proxy = await this.disksProxy();
    return Object.values(proxy).map(this.buildDisk);
  }

  /**
   * Gets the list of available WWPNs for the given zFCP controller
   *
   * @param {ZFCPController} controller
   * @returns {Promise<string[]|undefined>} e.g., ["0x500507630703d3b3", 0x500507630708d3b3]
   */
  async getWWPNs(controller) {
    const proxy = await this.controllerProxy(controller);
    return proxy?.GetWWPNs();
  }

  /**
   * Gets the list of available LUNs for the WWPN of the given zFCP controller
   *
   * @param {ZFCPController} controller
   * @param {string} wwpn
   * @returns {Promise<string[]|undefined>} e.g., ["0x0000000000000000", "0x0000000000000001"]
   */
  async getLUNs(controller, wwpn) {
    const proxy = await this.controllerProxy(controller);
    return proxy?.GetLUNs(wwpn);
  }

  /**
   * Tries to activate the given zFCP controller
   *
   * @param {ZFCPController} controller
   * @returns {Promise<number|undefined>} Exit code of chzdev command (0 success)
   */
  async activateController(controller) {
    const proxy = await this.controllerProxy(controller);
    return proxy?.Activate();
  }

  /**
   * Tries to activate the given zFCP LUN
   *
   * @param {ZFCPController} controller
   * @param {string} wwpn
   * @param {string} lun
   * @returns {Promise<number|undefined>} Exit code of chzdev command (0 success)
   */
  async activateDisk(controller, wwpn, lun) {
    const proxy = await this.controllerProxy(controller);
    return proxy?.ActivateDisk(wwpn, lun);
  }

  /**
   * Tries to deactivate the given zFCP LUN
   *
   * @param {ZFCPController} controller
   * @param {string} wwpn
   * @param {string} lun
   * @returns {Promise<number|undefined>} Exit code of chzdev command (0 success)
   */
  async deactivateDisk(controller, wwpn, lun) {
    const proxy = await this.controllerProxy(controller);
    return proxy?.DeactivateDisk(wwpn, lun);
  }

  /**
   * Subscribes to signal that is emitted when a zFCP controller changes
   *
   * @param {ZFCPControllerSignalHandler} handler
   * @returns {Promise<function>} Unsubscribe function
   */
  async onControllerChanged(handler) {
    const unsubscribeFn = this.controllerEventListener("changed", handler);
    return unsubscribeFn;
  }

  /**
   * Subscribes to signal that is emitted when a zFCP disk is added
   *
   * @param {ZFCPDiskSignalHandler} handler
   * @returns {Promise<function>} Unsubscribe function
   */
  async onDiskAdded(handler) {
    const unsubscribeFn = this.diskEventListener("added", handler);
    return unsubscribeFn;
  }

  /**
   * Subscribes to signal that is emitted when a zFCP disk is changed
   *
   * @param {ZFCPDiskSignalHandler} handler
   * @returns {Promise<function>} Unsubscribe function
   */
  async onDiskChanged(handler) {
    const unsubscribeFn = this.diskEventListener("changed", handler);
    return unsubscribeFn;
  }

  /**
   * Subscribes to signal that is emitted when a zFCP disk is removed
   *
   * @param {ZFCPDiskSignalHandler} handler
   * @returns {Promise<function>} Unsubscribe function
   */
  async onDiskRemoved(handler) {
    const unsubscribeFn = this.diskEventListener("removed", handler);
    return unsubscribeFn;
  }

  /**
   * @private
   * Proxy for org.opensuse.Agama.Storage1.ZFCP.Manager iface
   *
   * @returns {Promise<ZFCPManagerProxy|undefined>}
   *
   * @typedef {object} ZFCPManagerProxy
   * @property {boolean} AllowLUNScan
   * @property {function} Probe
   */
  async managerProxy() {
    if (!this.proxies.manager) {
      this.proxies.manager = await this.client().proxy(ZFCP_MANAGER_IFACE, STORAGE_OBJECT);
    }

    return this.proxies.manager;
  }

  /**
   * @private
   * Proxy for objects implementing org.opensuse.Agama.Storage1.ZFCP.Controller iface
   *
   * @note The zFCP controllers are dynamically exported.
   *
   * @returns {Promise<object>}
   */
  async controllersProxy() {
    if (!this.proxies.controllers)
      this.proxies.controllers = await this.client().proxies(ZFCP_CONTROLLER_IFACE, ZFCP_CONTROLLERS_NAMESPACE);

    return this.proxies.controllers;
  }

  /**
   * @private
   * Proxy for objects implementing org.opensuse.Agama.Storage1.ZFCP.Disk iface
   *
   * @note The zFCP disks are dynamically exported.
   *
   * @returns {Promise<object>}
   */
  async disksProxy() {
    if (!this.proxies.disks)
      this.proxies.disks = await this.client().proxies(ZFCP_DISK_IFACE, ZFCP_DISKS_NAMESPACE);

    return this.proxies.disks;
  }

  /**
   * @private
   * Proxy for org.opensuse.Agama.Storage1.ZFCP.Controller iface
   *
   * @param {ZFCPController} controller
   * @returns {Promise<ZFCPControllerProxy|undefined>}
   *
   * @typedef {object} ZFCPControllerProxy
   * @property {string} path
   * @property {boolean} Active
   * @property {boolean} LUNScan
   * @property {string} Channel
   * @property {function} GetWWPNs
   * @property {function} GetLUNs
   * @property {function} Activate
   * @property {function} ActivateDisk
   * @property {function} DeactivateDisk
   */
  async controllerProxy(controller) {
    const path = this.controllerPath(controller);
    const proxy = await this.client().proxy(ZFCP_CONTROLLER_IFACE, path);
    return proxy;
  }

  /**
   * @private
   * Subscribes to a signal from a zFCP controller
   *
   * @param {string} signal - "added", "changed", "removed"
   * @param {ZFCPControllerSignalHandler} handler
   * @returns {Promise<function>} Unsubscribe function
   *
   * @callback ZFCPControllerSignalHandler
   * @param {ZFCPController} controller
   */
  async controllerEventListener(signal, handler) {
    const proxy = await this.controllersProxy();
    const eventHandler = (_, proxy) => handler(this.buildController(proxy));
    const unsubscribeFn = await this.addEventListener(proxy, signal, eventHandler);
    return unsubscribeFn;
  }

  /**
   * @private
   * Subscribes to a signal from a zFCP disk
   *
   * @param {string} signal - "added", "changed", "removed"
   * @param {ZFCPDiskSignalHandler} handler
   * @returns {Promise<function>} Unsubscribe function
   *
   * @callback ZFCPDiskSignalHandler
   * @param {ZFCPDisk} disk
   */
  async diskEventListener(signal, handler) {
    const proxy = await this.disksProxy();
    const eventHandler = (_, proxy) => handler(this.buildDisk(proxy));
    const unsubscribeFn = await this.addEventListener(proxy, signal, eventHandler);
    return unsubscribeFn;
  }

  /**
   * @private
   * Subscribes to a signal
   *
   * @param {object} proxy
   * @param {string} signal
   * @param {function} handler
   * @returns {Promise<function>} Unsubscribe function
   */
  async addEventListener(proxy, signal, handler) {
    proxy.addEventListener(signal, handler);
    return () => proxy.removeEventListener(signal, handler);
  }

  /**
   * @private
   * Builds a controller object
   *
   * @param {ZFCPControllerProxy} proxy
   * @returns {ZFCPController}
   *
   * @typedef {object} ZFCPController
   * @property {string} id
   * @property {boolean} active
   * @property {boolean} lunScan
   * @property {string} channel
   */
  buildController(proxy) {
    return {
      id: dbusBasename(proxy.path),
      active: proxy.Active,
      lunScan: proxy.LUNScan,
      channel: proxy.Channel
    };
  }

  /**
   * @private
   * Builds a disk object
   *
   * @param {ZFCPDiskProxy} proxy
   * @returns {ZFCPDisk}
   *
   * @typedef {object} ZFCPDiskProxy
   * @property {string} path
   * @property {string} Name
   * @property {string} Channel
   * @property {string} WWPN
   * @property {string} LUN
   *
   * @typedef {object} ZFCPDisk
   * @property {string} id
   * @property {string} name
   * @property {string} channel
   * @property {string} wwpn
   * @property {string} lun
   */
  buildDisk(proxy) {
    return {
      id: dbusBasename(proxy.path),
      name: proxy.Name,
      channel: proxy.Channel,
      wwpn: proxy.WWPN,
      lun: proxy.LUN
    };
  }

  /**
   * @private
   * Builds the D-Bus path for the given zFCP controller
   *
   * @param {ZFCPController} controller
   * @returns {string}
   */
  controllerPath(controller) {
    return ZFCP_CONTROLLERS_NAMESPACE + "/" + controller.id;
  }
}

/**
 * Class providing an API for managing iSCSI through D-Bus
 */
class ISCSIManager {
  /**
   * @param {string} service - D-Bus service name
   * @param {string} address - D-Bus address
   */
  constructor(service, address) {
    this.service = service;
    this.address = address;
    this.proxies = {};
  }

  /**
   * @return {DBusClient} client
   */
  client() {
    // return this.assigned_client;
    if (!this._client) {
      this._client = new DBusClient(this.service, this.address);
    }

    return this._client;
  }

  async getInitiatorIbft() {
    const proxy = await this.iscsiInitiatorProxy();
    return proxy.IBFT;
  }

  /**
   * Gets the iSCSI initiator name
   *
   * @returns {Promise<string>}
   */
  async getInitiatorName() {
    const proxy = await this.iscsiInitiatorProxy();
    return proxy.InitiatorName;
  }

  /**
   * Sets the iSCSI initiator name
   *
   * @param {string} value
   */
  async setInitiatorName(value) {
    const proxy = await this.iscsiInitiatorProxy();
    proxy.InitiatorName = value;
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
    const proxy = await this.iscsiNodesProxy();
    return Object.values(proxy).map(this.buildNode);
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

    const proxy = await this.iscsiInitiatorProxy();
    return proxy.Discover(address, port, auth);
  }

  /**
   * Sets the startup status of the connection
   *
   * @param {ISCSINode} node
   * @param {String} startup
   */
  async setStartup(node, startup) {
    const path = this.nodePath(node);

    const proxy = await this.client().proxy(ISCSI_NODE_IFACE, path);
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

    const proxy = await this.iscsiInitiatorProxy();
    return proxy.Delete(path);
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

    const proxy = await this.client().proxy(ISCSI_NODE_IFACE, path);
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
    const proxy = await this.client().proxy(ISCSI_NODE_IFACE, path);
    return proxy.Logout();
  }

  onInitiatorChanged(handler) {
    return this.client().onObjectChanged(STORAGE_OBJECT, ISCSI_INITIATOR_IFACE, (changes) => {
      const data = {
        name: changes.InitiatorName?.v,
        ibft: changes.IBFT?.v
      };

      const filtered = Object.entries(data).filter(([, v]) => v !== undefined);
      return handler(Object.fromEntries(filtered));
    });
  }

  async onNodeAdded(handler) {
    const proxy = await this.iscsiNodesProxy();
    proxy.addEventListener("added", (_, proxy) => handler(this.buildNode(proxy)));
  }

  async onNodeChanged(handler) {
    const proxy = await this.iscsiNodesProxy();
    proxy.addEventListener("changed", (_, proxy) => handler(this.buildNode(proxy)));
  }

  async onNodeRemoved(handler) {
    const proxy = await this.iscsiNodesProxy();
    proxy.addEventListener("removed", (_, proxy) => handler(this.buildNode(proxy)));
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
   * Proxy for org.opensuse.Agama.Storage1.ISCSI.Initiator iface
   *
   * @returns {Promise<object>}
   */
  async iscsiInitiatorProxy() {
    if (!this.proxies.iscsiInitiator) {
      this.proxies.iscsiInitiator = await this.client().proxy(ISCSI_INITIATOR_IFACE, STORAGE_OBJECT);
    }

    return this.proxies.iscsiInitiator;
  }

  /**
   * @private
   * Proxy for objects implementing org.opensuse.Agama.Storage1.ISCSI.Node iface
   *
   * @note The ISCSI nodes are dynamically exported.
   *
   * @returns {Promise<object>}
   */
  async iscsiNodesProxy() {
    if (!this.proxies.iscsiNodes)
      this.proxies.iscsiNodes = await this.client().proxies(ISCSI_NODE_IFACE, ISCSI_NODES_NAMESPACE);

    return this.proxies.iscsiNodes;
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
  static SERVICE = "org.opensuse.Agama.Storage1";

  /**
   * @param {string|undefined} address - D-Bus address; if it is undefined, it uses the system bus.
   */
  constructor(address = undefined) {
    this.client = new DBusClient(StorageBaseClient.SERVICE, address);
    this.system = new DevicesManager(this.client, STORAGE_SYSTEM_NAMESPACE);
    this.staging = new DevicesManager(this.client, STORAGE_STAGING_NAMESPACE);
    this.proposal = new ProposalManager(this.client, this.system);
    this.iscsi = new ISCSIManager(StorageBaseClient.SERVICE, address);
    this.dasd = new DASDManager(StorageBaseClient.SERVICE, address);
    this.zfcp = new ZFCPManager(StorageBaseClient.SERVICE, address);
    this.proxies = {
      storage: this.client.proxy(STORAGE_IFACE)
    };
  }

  /**
   * Probes the system
   */
  async probe() {
    const proxy = await this.proxies.storage;
    return proxy.Probe();
  }

  /**
   * Whether the system is in a deprecated status
   *
   * @returns {Promise<boolean>}
   */
  async isDeprecated() {
    const proxy = await this.proxies.storage;
    return proxy.DeprecatedSystem;
  }

  /**
   * Runs a handler function when the system becomes deprecated
   *
   * @callback handlerFn
   * @return {void}
   *
   * @param {handlerFn} handler
   */
  onDeprecate(handler) {
    return this.client.onObjectChanged(STORAGE_OBJECT, STORAGE_IFACE, (changes) => {
      if (changes.DeprecatedSystem?.v) return handler();
    });
  }
}

/**
 * Allows interacting with the storage settings
 */
class StorageClient extends WithIssues(
  WithProgress(
    WithStatus(StorageBaseClient, STORAGE_OBJECT), STORAGE_OBJECT
  ), STORAGE_OBJECT
) { }

export { StorageClient, EncryptionMethods };
