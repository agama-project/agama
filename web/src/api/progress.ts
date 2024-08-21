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

import { get } from "~/api/http";
import { APIProgress, Progress } from "~/types/progress";

/**
 * Returns the progress information for a given service
 *
 * At this point, the services that implement the progress API are
 * "manager", "software" and "storage".
 *
 * @param service - Service to retrieve the progress from (e.g., "manager")
 */
const fetchProgress = async (service: string): Promise<Progress> => {
  const progress: APIProgress = await get(`/api/${service}/progress`);
  return Progress.fromApi(progress);
};

export { fetchProgress };
