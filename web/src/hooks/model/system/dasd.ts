/*
 * Copyright (c) [2026] SUSE LLC
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

import { useSuspenseQuery } from "@tanstack/react-query";
import { systemQuery } from "~/hooks/model/system";
import type { System, DASD } from "~/model/system";

/**
 * Extract DASD system information a system object.
 *
 * @remarks
 * Used by useSuspenseQuery's select option to transform the query result.
 * Returns undefined when data is undefined or when dasd property is not present.
 *
 * @see {@link https://tanstack.com/query/latest/docs/framework/react/guides/render-optimizations#select TanStack Query Select}
 * @see {@link https://tkdodo.eu/blog/react-query-selectors-supercharged#what-is-select Query Selectors Supercharged}
 */
const dasdSelector = (data: System | null): DASD.System => data?.dasd;

/**
 * Retrieve DASD system information.
 */
function useSystem(): DASD.System | null {
  const { data } = useSuspenseQuery({
    ...systemQuery,
    select: dasdSelector,
  });
  return data;
}

export { useSystem };
