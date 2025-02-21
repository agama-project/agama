/*
 * Copyright (c) [2024-2025] SUSE LLC
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
};

type PartitionTable = {
  type: string;
  partitions: StorageDevice[];
  unusedSlots: PartitionSlot[];
  unpartitionedSize: number;
};

type PartitionSlot = {
  start: number;
  size: number;
};

type Component = {
  // FIXME: should it be DeviceType?
  type: string;
  deviceNames: string[];
};

type Filesystem = {
  sid: number;
  type: string;
  mountPath?: string;
  label?: string;
};

type ShrinkingInfo = {
  supported?: number;
  unsupported?: string[];
};

type Action = {
  device: number;
  text: string;
  subvol: boolean;
  delete: boolean;
  resize: boolean;
};

type SpacePolicyAction = {
  deviceName: string;
  value: "delete" | "resizeIfNeeded";
};

type ISCSIInitiator = {
  name: string;
  ibft: boolean;
  offloadCard: string;
};

type ISCSINode = {
  id: string;
  target: string;
  address: string;
  port: number;
  interface: string;
  ibft: boolean;
  connected: boolean;
  startup: string;
};

export type {
  Action,
  Component,
  Filesystem,
  ISCSIInitiator,
  ISCSINode,
  PartitionSlot,
  PartitionTable,
  ShrinkingInfo,
  SpacePolicyAction,
  StorageDevice,
};
