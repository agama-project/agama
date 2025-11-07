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

import { get } from "~/http";
import { Issue, IssuesMap, IssuesScope } from "~/types/issues";

/**
 * Return the issues of the given scope.
 */
const fetchIssues = async (): Promise<Issue[]> => {
  const issues = (await get(`/api/v2/issues`)) as IssuesMap;
  return Object.keys(issues).reduce((all: Issue[], key: IssuesScope) => {
    const scoped = issues[key].map((i) => ({ ...i, scope: key }));
    return all.concat(scoped);
  }, []);
};

export { fetchIssues };
