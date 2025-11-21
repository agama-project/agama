/*
 * Copyright (c) [2025] SUSE LLC
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

/**
 * Data types.
 *
 * Types that represent the data used for managing (add, edit) config devices. These types are
 * typically used by forms and mutation hooks.
 */

import { apiModel } from "~/api/storage";

interface Partition extends Partial<Omit<apiModel.Partition, "filesystem" | "size">> {
  filesystem?: Filesystem;
  size?: Size;
}

type VolumeGroup = Partial<Omit<apiModel.VolumeGroup, "logicalVolumes">>;

interface LogicalVolume extends Partial<Omit<apiModel.LogicalVolume, "filesystem" | "size">> {
  filesystem?: Filesystem;
  size?: Size;
}

type Filesystem = Partial<Omit<apiModel.Filesystem, "default">>;

type Size = Partial<Omit<apiModel.Size, "default">>;

type SpacePolicyAction = {
  deviceName: string;
  value: "delete" | "resizeIfNeeded";
};

type SpacePolicy = {
  type: apiModel.SpacePolicy;
  actions?: SpacePolicyAction[];
};

type Formattable = {
  mountPath?: string;
  filesystem?: Filesystem;
};

// So far this type is used only for adding a pre-existing RAID searched by name. So we are starting
// with this simplistic definition. Such a definition will likely grow in the future if the same
// type is used for more operations.
type MdRaid = {
  name: string;
  spacePolicy?: apiModel.SpacePolicy;
};

// This type is used only for adding a disk device searched by name. See commend on MdRaid about
// starting simple.
type Drive = {
  name: string;
  spacePolicy?: apiModel.SpacePolicy;
};

export type {
  Drive,
  Filesystem,
  Formattable,
  LogicalVolume,
  MdRaid,
  Partition,
  Size,
  SpacePolicy,
  SpacePolicyAction,
  VolumeGroup,
};
