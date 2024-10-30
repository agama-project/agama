/*
 * Copyright (c) [2024] SUSE LLC
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
import { calculate, fetchSettings } from "~/api/storage/proposal";
import { config } from "~/api/storage/types";

/**
 * Starts the storage probing process.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const probe = (): Promise<any> => post("/api/storage/probe");

const fetchConfig = (): Promise<config.Config> => get("/api/storage/config");

const fetchSolvedConfig = (): Promise<config.Config> => get("/api/storage/solved_config");

const setConfig = (config: config.Config) => put("/api/storage/config", config);

/**
 * Returns the list of jobs
 */
const fetchStorageJobs = (): Promise<Job[]> => get("/api/storage/jobs");

/**
 * Returns the job with given id or undefined
 */
const findStorageJob = (id: string): Promise<Job | undefined> =>
  fetchStorageJobs().then((jobs: Job[]) => jobs.find((value) => value.id === id));

/**
 * Refreshes the storage layer.
 *
 * It does the probing again and recalculates the proposal with the same
 * settings. Internally, it is composed of three different API calls
 * (retrieve the settings, probe the system, and calculate the proposal).
 */
const refresh = async (): Promise<void> => {
  const settings = await fetchSettings();
  await probe();
  await calculate(settings);
};

export {
  probe,
  fetchConfig,
  fetchSolvedConfig,
  setConfig,
  fetchStorageJobs,
  findStorageJob,
  refresh,
};
