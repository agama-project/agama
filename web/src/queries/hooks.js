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

import { useRevalidator } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

/**
 * Allows invalidating cached data
 *
 * This hook is useful for marking data as outdated and retrieve it again. To do so, it performs two important steps
 *   - ask @tanstack/react-query to invalidate query matching given key
 *   - ask react-router-dom for a revalidation of loaded data
 *
 * TODO: rethink the revalidation; we may decide to keep the outdated data
 * instead, but warning the user about it (as Github does when reviewing a PR,
 * for example)
 *
 * TODO: allow to specify more than one queryKey
 *
 * To know more, please visit the documentation of these dependencies
 *
 *   - https://tanstack.com/query/v5/docs/framework/react/guides/query-invalidation
 *   - https://reactrouter.com/en/main/hooks/use-revalidator#userevalidator
 *
 * @example
 *
 * const dataInvalidator = useDataInvalidator();
 *
 * useEffect(() => {
 *   dataInvalidator({ queryKey: ["user", "auth"] })
 * }, [dataInvalidator]);
 */
const useDataInvalidator = () => {
  const queryClient = useQueryClient();
  const revalidator = useRevalidator();

  const dataInvalidator = ({ queryKey }) => {
    if (queryKey) queryClient.invalidateQueries({ queryKey });
    revalidator.revalidate();
  };

  return dataInvalidator;
};

export {
  useDataInvalidator
};
