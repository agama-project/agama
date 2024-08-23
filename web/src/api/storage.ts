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

import { post, get, put } from "~/api/http";
import { Job } from "~/types/job";

/**
 * Returns the list of jobs
 */
const fetchStorageJobs = async (): Promise<Job[]> => {
    const jobs: Job[] = await get("/api/manager/installer");
    return jobs;
  };

/**
 * Returns the job with given id or undefined
 */
const findStorageJob = async (id: string): Promise<Job|undefined> => {
  return fetchStorageJobs().then((jobs: Job[]) => jobs.find((value, _i, _o) => value.id === id));
};

  export { fetchStorageJobs, findStorageJob };