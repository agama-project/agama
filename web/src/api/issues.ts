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
import { Issue, IssuesScope } from "~/types/issues";

const URLS = {
  product: "software/issues/product",
  software: "software/issues/software",
  users: "users/issues",
  storage: "storage/issues",
};

/**
 * Return the issues of the given scope.
 */
const fetchIssues = (scope: IssuesScope): Promise<Issue[]> => get(`/api/${URLS[scope]}`);

export { fetchIssues };
