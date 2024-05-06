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

import { compact, hex, uniq } from "~/utils";
import { WithIssues, WithStatus, WithProgress } from "./mixins";
import { HTTPClient } from "./http";

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
 * @typedef {object} StorageDevice
 * @property {number} sid - Storage ID
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
 * @property {boolean} [dellBOSS]
 * @property {StorageDevice[]} [devices] - RAID devices (only for "raid" and "md" types)
 * @property {StorageDevice[]} [wires] - Multipath wires (only for "multipath" type)
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
 * @property {number} sid
 * @property {string} type
 * @property {string} [mountPath]
 * @property {string} [label]
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
 *
 * @todo Define an enum for space policies.
 *
 * @typedef {object} ProposalSettings
 * @property {ProposalTarget} target
 * @property {string} [targetDevice]
 * @property {string[]} targetPVDevices
 * @property {boolean} configureBoot
 * @property {string} bootDevice
 * @property {string} defaultBootDevice
 * @property {string} encryptionPassword
 * @property {string} encryptionMethod
 * @property {string} spacePolicy
 * @property {SpaceAction[]} spaceActions
 * @property {Volume[]} volumes
 * @property {StorageDevice[]} installationDevices
 *
 * @typedef {keyof ProposalTargets} ProposalTarget
 *
 * @typedef {object} SpaceAction
 * @property {string} device
 * @property {string} action
 *
 * @typedef {object} Volume
 * @property {string} mountPath
 * @property {VolumeTarget} target
 * @property {StorageDevice} [targetDevice]
 * @property {string} fsType
 * @property {number} minSize
 * @property {number} [maxSize]
 * @property {boolean} autoSize
 * @property {boolean} snapshots
 * @property {boolean} transactional
 * @property {VolumeOutline} outline
 *
 * @typedef {keyof VolumeTargets} VolumeTarget
 *
 * @todo Define an enum for file system types.
 *
 * @typedef {object} VolumeOutline
 * @property {boolean} required
 * @property {boolean} productDefined
 * @property {string[]} fsTypes
 * @property {boolean} adjustByRam
 * @property {boolean} supportAutoSize
 * @property {boolean} snapshotsConfigurable
 * @property {boolean} snapshotsAffectSizes
 * @property {string[]} sizeRelevantVolumes
 */

/**
 * Enum for the possible proposal targets.
 *
 * @readonly
 */
const ProposalTargets = Object.freeze({
  DISK: "disk",
  NEW_LVM_VG: "newLvmVg",
  REUSED_LVM_VG: "reusedLvmVg"
});

/**
 * Enum for the possible volume targets.
 *
 * @readonly
 */
const VolumeTargets = Object.freeze({
  DEFAULT: "default",
  NEW_PARTITION: "new_partition",
  NEW_VG: "new_vg",
  DEVICE: "device",
  FILESYSTEM: "filesystem"
});

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
   * @param {HTTPClient} client
   * @param {string} rootPath - path of the devices tree, either system or staging
   */
  constructor(client, rootPath) {
    this.client = client;
    this.rootPath = rootPath;
  }

  /**
   * Gets all the exported devices
   *
   * @returns {Promise<StorageDevice[]>}
   */
  async getDevices() {
    const response = await this.client.get(`/storage/devices/${this.rootPath}`);
    if (!response.ok) {
      console.log("Failed to get storage devices: ", response);
    }
    return response.json();
  }
}

/**
 * Class providing an API for managing the storage proposal through D-Bus
 */
class ProposalManager {
  /**
   * @param {HTTPClient} client
   * @param {DevicesManager} system
   */
  constructor(client, system) {
    this.client = client;
    this.system = system;
  }

  /**
   * Gets the list of available devices
   *
   * @returns {Promise<StorageDevice[]>}
   */
  async getAvailableDevices() {
    const findDevice = (devices, name) => {
      const device = devices.find(d => d.deviceInfo.name === name);

      if (device === undefined) console.log("Device not found: ", name);

      return device;
    };

    const systemDevices = await this.system.getDevices();

    const response = await this.client.get("/storage/proposal/usable_devices");
    if (!response.ok) {
      console.log("Failed to get usable devices: ", response);
    }
    const usable_devices = await response.json();
    return usable_devices.map(name => findDevice(systemDevices, name)).filter(d => d);
  }

  /**
   * Gets the devices that can be selected as target for a volume.
   *
   * A device can be selected as target for a volume if either it is an available device for
   * installation or it is a device built over the available devices for installation. For example,
   * a MD RAID is a possible target only if all its members are available devices or children of the
   * available devices.
   *
   * @returns {Promise<StorageDevice[]>}
   */
  async getVolumeDevices() {
    /** @type {StorageDevice[]} */
    const availableDevices = await this.getAvailableDevices();

    /** @type {(device: StorageDevice) => boolean} */
    const isAvailable = (device) => {
      const isChildren = (device, parentDevice) => {
        const partitions = parentDevice.partitionTable?.partitions || [];
        return !!partitions.find(d => d.name === device.name);
      };

      return !!availableDevices.find(d => d.name === device.name || isChildren(device, d));
    };

    /** @type {(device: StorageDevice[]) => boolean} */
    const allAvailable = (devices) => devices.every(isAvailable);

    const system = await this.system.getDevices();
    const mds = system.filter(d => d.type === "md" && allAvailable(d.devices));
    const vgs = system.filter(d => d.type === "lvmVg" && allAvailable(d.physicalVolumes));

    return [...availableDevices, ...mds, ...vgs];
  }

  /**
   * Gets the list of meaningful mount points for the selected product
   *
   * @returns {Promise<string[]>}
   */
  async getProductMountPoints() {
    const response = await this.client.get("/storage/product/params");
    if (!response.ok) {
      console.log("Failed to get product params: ", response);
    }

    return response.json().then(params => params.mountPoints);
  }

  /**
   * Gets the list of encryption methods accepted by the proposal
   *
   * @returns {Promise<string[]>}
   */
  async getEncryptionMethods() {
    const response = await this.client.get("/storage/product/params");
    if (!response.ok) {
      console.log("Failed to get product params: ", response);
    }

    return response.json().then(params => params.encryptionMethods);
  }

  /**
   * Obtains the default volume for the given mount path
   *
   * @param {string} mountPath
   * @returns {Promise<Volume>}
   */
  async defaultVolume(mountPath) {
    const param = encodeURIComponent(mountPath);
    const response = await this.client.get(`/storage/product/volume_for?mount_path=${param}`);
    if (!response.ok) {
      console.log("Failed to get product volume: ", response);
    }

    return response.json();
// TODO: change from master
//    const proxy = await this.proxies.proposalCalculator;
//    const systemDevices = await this.system.getDevices();
//    const productMountPoints = await this.getProductMountPoints();
//    return this.buildVolume(await proxy.DefaultVolume(mountPath), systemDevices, productMountPoints);
  }

  /**
   * Gets the values of the current proposal
   *
   * @return {Promise<ProposalResult|undefined>}
  */
  async getResult() {
    const proxy = await this.proposalProxy();

    if (!proxy) return undefined;

    const systemDevices = await this.system.getDevices();
    const productMountPoints = await this.getProductMountPoints();

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

      /**
       * Builds the proposal target from a D-Bus value.
       *
       * @param {string} dbusTarget
       * @returns {ProposalTarget}
       */
      const buildTarget = (dbusTarget) => {
        switch (dbusTarget) {
          case "disk": return "DISK";
          case "newLvmVg": return "NEW_LVM_VG";
          case "reusedLvmVg": return "REUSED_LVM_VG";
          default:
            console.info(`Unknown proposal target "${dbusTarget}", using "disk".`);
            return "DISK";
        }
      };

      const buildTargetPVDevices = dbusTargetPVDevices => {
        if (!dbusTargetPVDevices) return [];

        return dbusTargetPVDevices.v.map(d => d.v);
      };

      /** @todo Read installation devices from D-Bus. */
      const buildInstallationDevices = (dbusSettings, devices) => {
        const findDevice = (name) => {
          const device = devices.find(d => d.name === name);

          if (device === undefined) console.error("D-Bus object not found: ", name);

          return device;
        };

        // Only consider the device assigned to a volume as installation device if it is needed
        // to find space in that device. For example, devices directly formatted or mounted are not
        // considered as installation devices.
        const volumes = dbusSettings.Volumes.v.filter(vol => (
          [VolumeTargets.NEW_PARTITION, VolumeTargets.NEW_VG].includes(vol.v.Target.v))
        );

        const values = [
          dbusSettings.TargetDevice?.v,
          buildTargetPVDevices(dbusSettings.TargetPVDevices),
          volumes.map(vol => vol.v.TargetDevice.v)
        ].flat();

        if (dbusSettings.ConfigureBoot.v) values.push(dbusSettings.BootDevice.v);

        const names = uniq(compact(values)).filter(d => d.length > 0);

        // #findDevice returns undefined if no device is found with the given name.
        return compact(names.sort().map(findDevice));
      };

      const dbusSettings = proxy.Settings;

      return {
        settings: {
          target: buildTarget(dbusSettings.Target.v),
          targetDevice: dbusSettings.TargetDevice?.v,
          targetPVDevices: buildTargetPVDevices(dbusSettings.TargetPVDevices),
          configureBoot: dbusSettings.ConfigureBoot.v,
          bootDevice: dbusSettings.BootDevice.v,
          defaultBootDevice: dbusSettings.DefaultBootDevice.v,
          spacePolicy: dbusSettings.SpacePolicy.v,
          spaceActions: dbusSettings.SpaceActions.v.map(a => buildSpaceAction(a.v)),
          encryptionPassword: dbusSettings.EncryptionPassword.v,
          encryptionMethod: dbusSettings.EncryptionMethod.v,
          volumes: dbusSettings.Volumes.v.map(vol => (
            this.buildVolume(vol.v, systemDevices, productMountPoints))
          ),
          // NOTE: strictly speaking, installation devices does not belong to the settings. It
          // should be a separate method instead of an attribute in the settings object.
          // Nevertheless, it was added here for simplicity and to avoid passing more props in some
          // react components. Please, do not use settings as a jumble.
          installationDevices: buildInstallationDevices(proxy.Settings, systemDevices)
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
      target,
      targetDevice,
      targetPVDevices,
      configureBoot,
      bootDevice,
      encryptionPassword,
      encryptionMethod,
      spacePolicy,
      spaceActions,
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
        Target: { t: "s", v: VolumeTargets[volume.target] },
        TargetDevice: { t: "s", v: volume.targetDevice?.name },
        Snapshots: { t: "b", v: volume.snapshots },
        Transactional: { t: "b", v: volume.transactional },
      });
    };

    const dbusSettings = removeUndefinedCockpitProperties({
      Target: { t: "s", v: ProposalTargets[target] },
      TargetDevice: { t: "s", v: targetDevice },
      TargetPVDevices: { t: "as", v: targetPVDevices },
      ConfigureBoot: { t: "b", v: configureBoot },
      BootDevice: { t: "s", v: bootDevice },
      EncryptionPassword: { t: "s", v: encryptionPassword },
      EncryptionMethod: { t: "s", v: encryptionMethod },
      SpacePolicy: { t: "s", v: spacePolicy },
      SpaceActions: { t: "aa{sv}", v: dbusSpaceActions() },
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
   * @param {StorageDevice[]} devices
   * @param {string[]} productMountPoints
   *
   * @typedef {Object} DBusVolume
   * @property {CockpitString} Target
   * @property {CockpitString} [TargetDevice]
   * @property {CockpitString} MountPath
   * @property {CockpitString} FsType
   * @property {CockpitNumber} MinSize
   * @property {CockpitNumber} [MaxSize]
   * @property {CockpitBoolean} AutoSize
   * @property {CockpitBoolean} Snapshots
   * @property {CockpitBoolean} Transactional
   * @property {CockpitString} Target
   * @property {CockpitString} [TargetDevice]
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
  buildVolume(dbusVolume, devices, productMountPoints) {
    /**
     * Builds a volume target from a D-Bus value.
     *
     * @param {string} dbusTarget
     * @returns {VolumeTarget}
     */
    const buildTarget = (dbusTarget) => {
      switch (dbusTarget) {
        case "default": return "DEFAULT";
        case "new_partition": return "NEW_PARTITION";
        case "new_vg": return "NEW_VG";
        case "device": return "DEVICE";
        case "filesystem": return "FILESYSTEM";
        default:
          console.info(`Unknown volume target "${dbusTarget}", using "default".`);
          return "DEFAULT";
      }
    };

    /** @returns {VolumeOutline} */
    const buildOutline = (dbusOutline) => {
      return {
        required: dbusOutline.Required.v,
        productDefined: false,
        fsTypes: dbusOutline.FsTypes.v.map(val => val.v),
        supportAutoSize: dbusOutline.SupportAutoSize.v,
        adjustByRam: dbusOutline.AdjustByRam.v,
        snapshotsConfigurable: dbusOutline.SnapshotsConfigurable.v,
        snapshotsAffectSizes: dbusOutline.SnapshotsAffectSizes.v,
        sizeRelevantVolumes: dbusOutline.SizeRelevantVolumes.v.map(val => val.v)
      };
    };

    const volume = {
      target: buildTarget(dbusVolume.Target.v),
      targetDevice: devices.find(d => d.name === dbusVolume.TargetDevice?.v),
      mountPath: dbusVolume.MountPath.v,
      fsType: dbusVolume.FsType.v,
      minSize: dbusVolume.MinSize.v,
      maxSize: dbusVolume.MaxSize?.v,
      autoSize: dbusVolume.AutoSize.v,
      snapshots: dbusVolume.Snapshots.v,
      transactional: dbusVolume.Transactional.v,
      outline: buildOutline(dbusVolume.Outline.v)
    };

    // Indicate whether a volume is defined by the product.
    if (productMountPoints.includes(volume.mountPath))
      volume.outline.productDefined = true;

    return volume;
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
   * @param {import("./http").HTTPClient} client - HTTP client.
   */
  constructor(client = undefined) {
    this.client = client;
    this.system = new DevicesManager(this.client, "system");
    this.staging = new DevicesManager(this.client, "staging");
    this.proposal = new ProposalManager(this.client, this.system);
    this.iscsi = new ISCSIManager(StorageBaseClient.SERVICE, client);
    this.dasd = new DASDManager(StorageBaseClient.SERVICE, client);
    this.zfcp = new ZFCPManager(StorageBaseClient.SERVICE, client);
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
    const response = await this.client.get("/storage/devices/dirty");
    if (!response.ok) {
      console.log("Failed to get storage devices dirty: ", response);
    }
    return response.json();
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
    return this.client.onEvent("DevicesDirty", ({ value }) => {
      if (value) {
        handler();
      }
    });
  }
}

/**
 * Allows interacting with the storage settings
 */
class StorageClient extends WithIssues(
  WithProgress(
    WithStatus(StorageBaseClient, "/storage/status", STORAGE_OBJECT), "/storage/progress", STORAGE_OBJECT
  ), "/storage/issues", STORAGE_OBJECT
) { }

export { StorageClient, EncryptionMethods };
