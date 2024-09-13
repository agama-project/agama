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

import { get, post } from "~/api/http";
import { Job } from "~/types/job";
import { calculate, fetchSettings } from "~/api/storage/proposal";

/**
 * Starts the storage probing process.
 */
const probe = (): Promise<any> => post("/api/storage/probe");

export { probe };

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

export { fetchStorageJobs, findStorageJob, refresh };
