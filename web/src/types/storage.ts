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

type StorageDevice = {
  sid: number;
  name: string;
  description: string;
  isDrive: boolean;
  type: string;
  vendor?: string;
  model?: string;
  driver?: string[];
  bus?: string;
  busId?: string;
  transport?: string;
  sdCard?: boolean;
  dellBOSS?: boolean;
  devices?: StorageDevice[];
  wires?: StorageDevice[];
  level?: string;
  uuid?: string;
  start?: number;
  active?: boolean;
  encrypted?: boolean;
  isEFI?: boolean;
  size?: number;
  shrinking?: ShrinkingInfo;
  systems?: string[];
  udevIds?: string[];
  udevPaths?: string[];
  partitionTable?: PartitionTable;
  filesystem?: Filesystem;
  component?: Component;
  physicalVolumes?: StorageDevice[];
  logicalVolumes?: StorageDevice[];
}

type PartitionTable = {
  type: string,
  partitions: StorageDevice[],
  unusedSlots: PartitionSlot[],
  unpartitionedSize: number
}

type PartitionSlot = {
  start: number,
  size: number
}

type Component = {
  // FIXME: should it be DeviceType?
  type: string,
  deviceNames: string[],
}

type Filesystem = {
  sid: number,
  type: string,
  mountPath?: string,
  label?: string
}

type ShrinkingInfo = {
  supported?: number;
  unsupported?: string[]
}

type ProposalResult = {
  settings: ProposalSettings,
  actions: Action[]
}

type Action = {
  device: number;
  text: string;
  subvol: boolean;
  delete: boolean;
  resize: boolean;
}

type ProposalSettings = {
  target: ProposalTarget;
  targetDevice?: string;
  targetPVDevices: string[];
  configureBoot: boolean;
  bootDevice: string;
  defaultBootDevice: string;
  encryptionPassword: string;
  encryptionMethod: string;
  encryptionPBKDFunction?: string,
  spacePolicy: string;
  spaceActions: SpaceAction[];
  volumes: Volume[];
  installationDevices: StorageDevice[];
};

type SpaceAction = {
  device: string;
  action: 'force_delete' | 'resize'
};

type Volume = {
  mountPath: string;
  target: VolumeTarget;
  targetDevice?: StorageDevice;
  fsType: string;
  minSize: number;
  maxSize?: number;
  autoSize: boolean;
  snapshots: boolean;
  transactional: boolean;
  outline: VolumeOutline;
};

type VolumeOutline = {
  required: boolean;
  productDefined: boolean;
  fsTypes: string[];
  adjustByRam: boolean;
  supportAutoSize: boolean;
  snapshotsConfigurable: boolean;
  snapshotsAffectSizes: boolean;
  sizeRelevantVolumes: string[];
}

/**
 * Enum for the possible proposal targets.
 *
 * @readonly
 */
enum ProposalTarget {
  DISK = "disk",
  NEW_LVM_VG = "newLvmVg",
  REUSED_LVM_VG = "reusedLvmVg",
};

/**
 * Enum for the possible volume targets.
 *
 * @readonly
 */
enum VolumeTarget {
  DEFAULT = "default",
  NEW_PARTITION = "new_partition",
  NEW_VG = "new_vg",
  DEVICE = "device",
  FILESYSTEM = "filesystem",
};

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


export type {
  Action,
  Component,
  Filesystem,
  PartitionSlot,
  PartitionTable,
  ProposalResult,
  ProposalSettings,
  ShrinkingInfo,
  SpaceAction,
  StorageDevice,
  Volume,
  VolumeOutline,
};

export {
  EncryptionMethods,
  ProposalTarget,
  VolumeTarget
};
