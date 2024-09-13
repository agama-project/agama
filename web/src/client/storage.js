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
import { WithStatus } from "./mixins";
import { HTTPClient } from "./http";
import { fetchDevices } from "~/api/storage/devices";

const SERVICE_NAME = "org.opensuse.Agama.Storage1";
const STORAGE_OBJECT = "/org/opensuse/Agama/Storage1";
const STORAGE_JOBS_NAMESPACE = "/org/opensuse/Agama/Storage1/jobs";
const STORAGE_JOB_IFACE = "org.opensuse.Agama.Storage1.Job";
const ISCSI_NODES_NAMESPACE = "/storage/iscsi/nodes";
const ZFCP_MANAGER_IFACE = "org.opensuse.Agama.Storage1.ZFCP.Manager";
const ZFCP_CONTROLLERS_NAMESPACE = "/org/opensuse/Agama/Storage1/zfcp_controllers";
const ZFCP_CONTROLLER_IFACE = "org.opensuse.Agama.Storage1.ZFCP.Controller";
const ZFCP_DISKS_NAMESPACE = "/org/opensuse/Agama/Storage1/zfcp_disks";
const ZFCP_DISK_IFACE = "org.opensuse.Agama.Storage1.ZFCP.Disk";

/** @fixme Adapt code depending on D-Bus */
class DBusClient {
  /**
   * @param {string} service
   * @param {string|undefined} address
   */
  constructor(service, address) {
    console.warn(`FIXME: Adapt code depending on D-Bus ${service} ${address}`);
  }

  /**
   * @param {string} iface
   * @param {string} [path]
   * @return {Promise<object,undefined>}
   */
  async proxy(iface, path) {
    console.warn(`FIXME: Adapt code depending on D-Bus ${iface} ${path}`);
    return Promise.resolve(undefined);
  }

  /**
   * @param {string|undefined} iface
   * @param {string|undefined} path_namespace
   * @param {object|undefined} options
   * @return {Promise<any>}
   */
  async proxies(iface, path_namespace, options) {
    console.warn(`FIXME: Adapt code depending on D-Bus ${iface} ${path_namespace} ${options}`);
    return Promise.resolve(undefined);
  }
}

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
 * @property {ShrinkingInfo} [shrinking]
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
 * @typedef {object} ShrinkingInfo
 * @property {number} [supported] - Min size the device can be shrunk to.
 * @property {string[]} [unsupported] - Reasons why the device cannot be shrunk.
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
 * @property {boolean} resize
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
  REUSED_LVM_VG: "reusedLvmVg",
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
  FILESYSTEM: "filesystem",
});

/**
 * Enum for the encryption method values
 *
 * @readonly
 * @enum { string }
 */
const EncryptionMethods = Object.freeze({
  LUKS2: "luks2",
  TPM: "tpm_fde",
});

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
 * Class providing an API for managing the storage proposal through D-Bus
 */
class ProposalManager {
  /**
   * @param {HTTPClient} client
   */
  constructor(client) {
    this.client = client;
  }

  /**
   * Gets the list of available devices
   *
   * @returns {Promise<StorageDevice[]>}
   */
  async getAvailableDevices() {
    const findDevice = (devices, sid) => {
      const device = devices.find((d) => d.sid === sid);

      if (device === undefined) console.warn("Device not found: ", sid);

      return device;
    };

    const systemDevices = await fetchDevices("system");

    const response = await this.client.get("/storage/proposal/usable_devices");
    if (!response.ok) {
      console.warn("Failed to get usable devices: ", response);
      return [];
    }
    const usable_devices = await response.json();
    return usable_devices.map((sid) => findDevice(systemDevices, sid)).filter((d) => d);
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
        return !!partitions.find((d) => d.name === device.name);
      };

      return !!availableDevices.find((d) => d.name === device.name || isChildren(device, d));
    };

    /** @type {(device: StorageDevice[]) => boolean} */
    const allAvailable = (devices) => devices.every(isAvailable);

    const system = await fetchDevices("system");
    const mds = system.filter((d) => d.type === "md" && allAvailable(d.devices));
    const vgs = system.filter((d) => d.type === "lvmVg" && allAvailable(d.physicalVolumes));

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
      console.warn("Failed to get product params: ", response);
      return [];
    }

    return response.json().then((params) => params.mountPoints);
  }

  /**
   * Gets the list of encryption methods accepted by the proposal
   *
   * @returns {Promise<string[]>}
   */
  async getEncryptionMethods() {
    const response = await this.client.get("/storage/product/params");
    if (!response.ok) {
      console.warn("Failed to get product params: ", response);
      return [];
    }

    return response.json().then((params) => params.encryptionMethods);
  }

  /**
   * Obtains the default volume for the given mount path
   *
   * @param {string} mountPath
   * @returns {Promise<Volume|undefined>}
   */
  async defaultVolume(mountPath) {
    const param = encodeURIComponent(mountPath);
    const response = await this.client.get(`/storage/product/volume_for?mount_path=${param}`);
    if (!response.ok) {
      console.warn("Failed to get product volume: ", response);
      return undefined;
    }

    const systemDevices = await fetchDevices("system");
    const productMountPoints = await this.getProductMountPoints();

    return response.json().then((volume) => {
      return this.buildVolume(volume, systemDevices, productMountPoints);
    });
  }

  /**
   * Gets the values of the current proposal
   *
   * @return {Promise<ProposalResult|undefined>}
   */
  async getResult() {
    const settingsResponse = await this.client.get("/storage/proposal/settings");
    if (!settingsResponse.ok) {
      console.warn("Failed to get proposal settings: ", settingsResponse);
      return undefined;
    }

    const actionsResponse = await this.client.get("/storage/proposal/actions");
    if (!actionsResponse.ok) {
      console.warn("Failed to get proposal actions: ", actionsResponse);
      return undefined;
    }

    /**
     * Builds the proposal target from a D-Bus value.
     *
     * @param {string} value
     * @returns {ProposalTarget}
     */
    const buildTarget = (value) => {
      switch (value) {
        case "disk":
          return "DISK";
        case "newLvmVg":
          return "NEW_LVM_VG";
        case "reusedLvmVg":
          return "REUSED_LVM_VG";
        default:
          console.info(`Unknown proposal target "${value}", using "disk".`);
          return "DISK";
      }
    };

    /** @todo Read installation devices from D-Bus. */
    const buildInstallationDevices = (settings, devices) => {
      const findDevice = (name) => {
        const device = devices.find((d) => d.name === name);

        if (device === undefined) console.error("Device object not found: ", name);

        return device;
      };

      // Only consider the device assigned to a volume as installation device if it is needed
      // to find space in that device. For example, devices directly formatted or mounted are not
      // considered as installation devices.
      const volumes = settings.volumes.filter((vol) =>
        [VolumeTargets.NEW_PARTITION, VolumeTargets.NEW_VG].includes(vol.target),
      );

      const values = [
        settings.targetDevice,
        settings.targetPVDevices,
        volumes.map((v) => v.targetDevice),
      ].flat();

      if (settings.configureBoot) values.push(settings.bootDevice);

      const names = uniq(compact(values)).filter((d) => d.length > 0);

      // #findDevice returns undefined if no device is found with the given name.
      return compact(names.sort().map(findDevice));
    };

    const settings = await settingsResponse.json();
    const actions = await actionsResponse.json();

    const systemDevices = await fetchDevices("system");
    const productMountPoints = await this.getProductMountPoints();

    return {
      settings: {
        ...settings,
        target: buildTarget(settings.target),
        volumes: settings.volumes.map((v) =>
          this.buildVolume(v, systemDevices, productMountPoints),
        ),
        // NOTE: strictly speaking, installation devices does not belong to the settings. It
        // should be a separate method instead of an attribute in the settings object.
        // Nevertheless, it was added here for simplicity and to avoid passing more props in some
        // react components. Please, do not use settings as a jumble.
        installationDevices: buildInstallationDevices(settings, systemDevices),
      },
      actions,
    };
  }

  /**
   * Calculates a new proposal
   *
   * @param {ProposalSettings} settings
   * @returns {Promise<boolean>} true on success
   */
  async calculate(settings) {
    const buildHttpVolume = (volume) => {
      return {
        autoSize: volume.autoSize,
        fsType: volume.fsType,
        maxSize: volume.maxSize,
        minSize: volume.minSize,
        mountOptions: volume.mountOptions,
        mountPath: volume.mountPath,
        snapshots: volume.snapshots,
        target: VolumeTargets[volume.target],
        targetDevice: volume.targetDevice?.name,
      };
    };

    const buildHttpSettings = (settings) => {
      return {
        bootDevice: settings.bootDevice,
        configureBoot: settings.configureBoot,
        encryptionMethod: settings.encryptionMethod,
        encryptionPBKDFunction: settings.encryptionPBKDFunction,
        encryptionPassword: settings.encryptionPassword,
        spaceActions: settings.spacePolicy === "custom" ? settings.spaceActions : undefined,
        spacePolicy: settings.spacePolicy,
        target: ProposalTargets[settings.target],
        targetDevice: settings.targetDevice,
        targetPVDevices: settings.targetPVDevices,
        volumes: settings.volumes?.map(buildHttpVolume),
      };
    };

    /** @fixe Define HttpSettings type */
    /** @type {object} */
    const httpSettings = buildHttpSettings(settings);
    const response = await this.client.put("/storage/proposal/settings", httpSettings);

    if (!response.ok) {
      console.warn("Failed to set the proposal settings: ", response);
      return false;
    }

    if (!response.json) {
      console.warn("A proposal cannot be calculated with the given settings: ", response);
      return false;
    }

    return response.json();
  }

  /**
   * @private
   * Builds a volume from the D-Bus data
   *
   * @param {object} rawVolume
   * @param {StorageDevice[]} devices
   * @param {string[]} productMountPoints
   *
   * @returns {Volume}
   */
  buildVolume(rawVolume, devices, productMountPoints) {
    /**
     * Builds a volume target from a D-Bus value.
     *
     * @param {string} value
     * @returns {VolumeTarget}
     */
    const buildTarget = (value) => {
      switch (value) {
        case "default":
          return "DEFAULT";
        case "new_partition":
          return "NEW_PARTITION";
        case "new_vg":
          return "NEW_VG";
        case "device":
          return "DEVICE";
        case "filesystem":
          return "FILESYSTEM";
        default:
          console.info(`Unknown volume target "${value}", using "default".`);
          return "DEFAULT";
      }
    };

    const volume = {
      ...rawVolume,
      target: buildTarget(rawVolume.target),
      targetDevice: devices.find((d) => d.name === rawVolume.targetDevice),
    };

    // Indicate whether a volume is defined by the product.
    volume.outline.productDefined = productMountPoints.includes(volume.mountPath);

    return volume;
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
      this.proxies.controllers = await this.client().proxies(
        ZFCP_CONTROLLER_IFACE,
        ZFCP_CONTROLLERS_NAMESPACE,
      );

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
      channel: proxy.Channel,
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
      lun: proxy.LUN,
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
   * @param {import("./http").HTTPClient} client - HTTP client.
   */
  constructor(client) {
    this.client = client;
  }

  /**
   * Gets the iSCSI initiator
   *
   * @return {Promise<ISCSIInitiator|undefined>}
   *
   * @typedef {object} ISCSIInitiator
   * @property {string} name
   * @property {boolean} ibft
   */
  async getInitiator() {
    const response = await this.client.get("/storage/iscsi/initiator");
    if (!response.ok) {
      console.error("Failed to get the iSCSI initiator", response);
      return undefined;
    }

    return response.json();
  }

  /**
   * Sets the iSCSI initiator name
   *
   * @param {string} value
   */
  setInitiatorName(value) {
    return this.client.patch("/storage/iscsi/initiator", { name: value });
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
    const response = await this.client.get("/storage/iscsi/nodes");
    if (!response.ok) {
      console.error("Failed to get the list of iSCSI nodes", response);
      return [];
    }

    return response.json();
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
   * @returns {Promise<boolean>} true on success, false on failure
   */
  async discover(address, port, options = {}) {
    const data = {
      address,
      port,
      options,
    };
    const response = await this.client.post("/storage/iscsi/discover", data);
    return response.ok;
  }

  /**
   * Sets the startup status of the connection
   *
   * @param {ISCSINode} node
   * @param {String} startup
   */
  setStartup(node, startup) {
    this.client.patch(this.nodePath(node), { startup });
  }

  /**
   * Deletes the given iSCSI node
   *
   * @param {ISCSINode} node
   * @returns {Promise<boolean>} 0 on success, 1 on failure if the given path is not exported, 2 on
   *  failure because any other reason.
   */
  async delete(node) {
    // FIXME: return the proper error code
    const response = await this.client.delete(this.nodePath(node));
    return response.ok;
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
    const path = this.nodePath(node) + "/login";
    const response = await this.client.post(path, options);
    if (!response.ok) {
      const reason = await response.json();
      console.warn("Could not login into the iSCSI node", reason);
      return reason === "InvalidStartup" ? 1 : 2;
    }

    return 0;
  }

  /**
   * Closes an iSCSI session
   *
   * @param {ISCSINode} node
   * @returns {Promise<boolean>} true on success, false on failure
   */
  async logout(node) {
    const path = this.nodePath(node) + "/logout";
    const response = await this.client.post(path);
    if (!response.ok) {
      console.error("Could not logout from the iSCSI node", response);
      return false;
    }

    return true;
  }

  /**
   * Registers a callback for initiator changes.
   *
   * @param {(event: object) => void} handler - Callback.
   */
  onInitiatorChanged(handler) {
    return this.client.onEvent("ISCSIInitiatorChanged", handler);
  }

  /**
   * Registers a callback to run when an iSCSI node appears.
   *
   * @param {(node: ISCSINode) => void} handler - callback which receives the
   *   ISCSINode object.
   */
  onNodeAdded(handler) {
    return this.onNodeEvent("ISCSINodeAdded", handler);
  }

  /**
   * Registers a callback to run when an iSCSI node changes.
   *
   * @param {(node: ISCSINode) => void} handler - callback which receives the
   *   ISCSINode object.
   */
  onNodeChanged(handler) {
    return this.onNodeEvent("ISCSINodeChanged", handler);
  }

  /**
   * Registers a callback to run when an iSCSI node disappears.
   *
   * @param {(node: ISCSINode) => void} handler - callback which receives the
   *   ISCSINode object.
   */
  onNodeRemoved(handler) {
    return this.onNodeEvent("ISCSINodeRemoved", handler);
  }

  /**
   * @private
   * Registers a handler for the given iSCSI node event.
   *
   * @param {string} eventName - Event name.
   * @param {(node: ISCSINode) => void} handler - callback which receives the
   *   ISCSINode object.
   */
  onNodeEvent(eventName, handler) {
    return this.client.onEvent(eventName, ({ node }) => handler(node));
  }

  buildNode(proxy) {
    const id = (path) => path.split("/").slice(-1)[0];

    return {
      id: id(proxy.path),
      target: proxy.Target,
      address: proxy.Address,
      port: proxy.Port,
      interface: proxy.Interface,
      ibft: proxy.IBFT,
      connected: proxy.Connected,
      startup: proxy.Startup,
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
  static SERVICE = "org.opensuse.Agama.Storage1";

  /**
   * @param {import("./http").HTTPClient} client - HTTP client.
   */
  constructor(client = undefined) {
    this.client = client;
    this.proposal = new ProposalManager(this.client);
    this.iscsi = new ISCSIManager(this.client);
    // @ts-ignore
    this.zfcp = new ZFCPManager(StorageBaseClient.SERVICE, client);
  }

  /**
   * Probes the system
   */
  async probe() {
    const response = await this.client.post("/storage/probe");

    if (!response.ok) {
      console.warn("Failed to probe the storage setup: ", response);
    }
  }

  /**
   * Whether the system is in a deprecated status
   *
   * @returns {Promise<boolean>}
   */
  async isDeprecated() {
    const response = await this.client.get("/storage/devices/dirty");
    if (!response.ok) {
      console.warn("Failed to get storage devices dirty: ", response);
      return false;
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
class StorageClient extends WithStatus(StorageBaseClient, "/storage/status", SERVICE_NAME) {}

export { StorageClient, EncryptionMethods };
