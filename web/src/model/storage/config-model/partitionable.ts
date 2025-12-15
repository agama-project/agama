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

import configModel from "~/model/storage/config-model";
import partitionableModel from "~/model/storage/partitionable-model";
import type { ConfigModel } from "~/model/storage/config-model";

type Device = ConfigModel.Drive | ConfigModel.MdRaid;

type CollectionName = "drives" | "mdRaids";

type Location = { collection: CollectionName; index: number };

function isCollectionName(collection: string): collection is CollectionName {
  return collection === "drives" || collection === "mdRaids";
}

function all(config: ConfigModel.Config): Device[] {
  const drives = config.drives || [];
  const mdRaids = config.mdRaids || [];
  return [...drives, ...mdRaids];
}

function find(
  config: ConfigModel.Config,
  collection: CollectionName,
  index: number,
): Device | null {
  return config[collection]?.at(index) || null;
}

function findIndex(config: ConfigModel.Config, collection: CollectionName, name: string): number {
  const devices = config[collection] || [];
  return devices.findIndex((d) => d.name === name);
}

function findLocation(config: ConfigModel.Config, name: string): Location | null {
  const collections: CollectionName[] = ["drives", "mdRaids"];

  for (const collection of collections) {
    const index = findIndex(config, collection, name);
    if (index !== -1) {
      return { collection, index };
    }
  }

  return null;
}

function isUsed(config: ConfigModel.Config, deviceName: string): boolean {
  const device = all(config).find((d) => d.name === deviceName);

  return (
    configModel.isExplicitBootDevice(config, deviceName) ||
    configModel.isTargetDevice(config, deviceName) ||
    partitionableModel.usedMountPaths(device).length > 0
  );
}

function remove(
  config: ConfigModel.Config,
  collection: CollectionName,
  index: number,
): ConfigModel.Config {
  config = configModel.clone(config);
  config[collection]?.splice(index, 1);
  return config;
}

export default {
  isCollectionName,
  all,
  find,
  findIndex,
  findLocation,
  isUsed,
  remove,
};
export type { Device, CollectionName, Location };
