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
import { Action, config, apiModel, ProductParams, Volume } from "~/api/storage/types";

/**
 * Starts the storage probing process.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const probe = (): Promise<any> => post("/api/storage/probe");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const reprobe = (): Promise<any> => post("/api/storage/reprobe");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const reactivate = (): Promise<any> => post("/api/storage/reactivate");

const fetchConfig = (): Promise<config.Config | null> =>
  get("/api/storage/config").then((config) => config.storage ?? null);

const fetchConfigModel = (): Promise<apiModel.Config | undefined> =>
  get("/api/storage/config_model");

const setConfig = (config: config.Config) => put("/api/storage/config", { storage: config });

const resetConfig = () => put("/api/storage/config/reset", {});

const setConfigModel = (model: apiModel.Config) => put("/api/storage/config_model", model);

const solveConfigModel = (model: apiModel.Config): Promise<apiModel.Config> => {
  const serializedModel = encodeURIComponent(JSON.stringify(model));
  return get(`/api/storage/config_model/solve?model=${serializedModel}`);
};

const fetchAvailableDrives = (): Promise<number[]> => get(`/api/storage/devices/available_drives`);

const fetchCandidateDrives = (): Promise<number[]> => get(`/api/storage/devices/candidate_drives`);

const fetchAvailableMdRaids = (): Promise<number[]> =>
  get(`/api/storage/devices/available_md_raids`);

const fetchCandidateMdRaids = (): Promise<number[]> =>
  get(`/api/storage/devices/candidate_md_raids`);

const fetchProductParams = (): Promise<ProductParams> => get("/api/storage/product/params");

const fetchVolume = (mountPath: string): Promise<Volume> => {
  const path = encodeURIComponent(mountPath);
  return get(`/api/storage/product/volume_for?mount_path=${path}`);
};

const fetchVolumes = (mountPaths: string[]): Promise<Volume[]> =>
  Promise.all(mountPaths.map(fetchVolume));

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
  reactivate,
  fetchConfig,
  fetchConfigModel,
  setConfig,
  resetConfig,
  setConfigModel,
  solveConfigModel,
  fetchAvailableDrives,
  fetchCandidateDrives,
  fetchAvailableMdRaids,
  fetchCandidateMdRaids,
  fetchProductParams,
  fetchVolume,
  fetchVolumes,
  fetchActions,
  fetchStorageJobs,
  findStorageJob,
};
