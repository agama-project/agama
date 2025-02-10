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

import { get, post, put } from "~/api/http";
import { Job } from "~/types/job";
import { Action, config, configModel, ProductParams, Volume } from "~/api/storage/types";
import { fetchDevices } from "~/api/storage/devices";
import { StorageDevice, Volume as StorageVolume, VolumeTarget } from "~/types/storage";

/**
 * Starts the storage probing process.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const probe = (): Promise<any> => post("/api/storage/probe");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const reprobe = (): Promise<any> => post("/api/storage/reprobe");

const fetchConfig = (): Promise<config.Config | null> =>
  get("/api/storage/config").then((config) => config.storage ?? null);

const fetchConfigModel = (): Promise<configModel.Config | undefined> =>
  get("/api/storage/config_model");

const setConfig = (config: config.Config) => put("/api/storage/config", { storage: config });

const setConfigModel = (model: configModel.Config) => put("/api/storage/config_model", model);

const solveConfigModel = (model: configModel.Config): Promise<configModel.Config> => {
  const serializedModel = encodeURIComponent(JSON.stringify(model));
  return get(`/api/storage/config_model/solve?model=${serializedModel}`);
};

const fetchUsableDevices = (): Promise<number[]> => get(`/api/storage/proposal/usable_devices`);

const fetchProductParams = (): Promise<ProductParams> => get("/api/storage/product/params");

const fetchDefaultVolume = (mountPath: string): Promise<Volume | undefined> => {
  const path = encodeURIComponent(mountPath);
  return get(`/api/storage/product/volume_for?mount_path=${path}`);
};

const fetchVolumeTemplates = async (): Promise<StorageVolume[]> => {
  const buildVolume = (
    rawVolume: Volume,
    devices: StorageDevice[],
    productMountPoints: string[],
  ): StorageVolume => ({
    ...rawVolume,
    outline: {
      ...rawVolume.outline,
      // Indicate whether a volume is defined by the product.
      productDefined: productMountPoints.includes(rawVolume.mountPath),
    },
    minSize: rawVolume.minSize || 0,
    transactional: rawVolume.transactional || false,
    target: rawVolume.target as VolumeTarget,
    targetDevice: devices.find((d) => d.name === rawVolume.targetDevice),
  });

  const systemDevices = await fetchDevices("system");
  const product = await fetchProductParams();
  const mountPoints = ["", ...product.mountPoints];
  const rawVolumes = await Promise.all(mountPoints.map(fetchDefaultVolume));
  return rawVolumes
    .filter((v) => v !== undefined)
    .map((v) => buildVolume(v, systemDevices, product.mountPoints));
};

const fetchActions = (): Promise<Action[]> => get("/api/storage/devices/actions");

/**
 * Returns the list of jobs
 */
const fetchStorageJobs = (): Promise<Job[]> => get("/api/storage/jobs");

/**
 * Returns the job with given id or undefined
 */
const findStorageJob = (id: string): Promise<Job | undefined> =>
  fetchStorageJobs().then((jobs: Job[]) => jobs.find((value) => value.id === id));

export {
  probe,
  reprobe,
  fetchConfig,
  fetchConfigModel,
  setConfig,
  setConfigModel,
  solveConfigModel,
  fetchUsableDevices,
  fetchProductParams,
  fetchDefaultVolume,
  fetchVolumeTemplates,
  fetchActions,
  fetchStorageJobs,
  findStorageJob,
};
