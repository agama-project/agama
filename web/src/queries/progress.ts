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

import React from "react";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useInstallerClient } from "~/context/installer";
import { Progress } from "~/types/progress";
import { QueryHookOptions } from "~/types/queries";
import { fetchProgress } from "~/api/progress";

const servicesMap = {
  "/org/opensuse/Agama/Manager1": "manager",
  "/org/opensuse/Agama/Software1": "software",
  "/org/opensuse/Agama/Storage1": "storage",
};

const progressKeys = {
  all: () => ["progress"] as const,
  byService: (service: string) => [...progressKeys.all(), service] as const,
};

/**
 * Returns a query for retrieving the progress information for a given service
 *
 * At this point, the services that implement the progress API are
 * "manager", "software" and "storage".
 *
 * @param service - Service to retrieve the progress from (e.g., "manager")
 */
const progressQuery = (service: string) => {
  return {
    queryKey: progressKeys.byService(service),
    queryFn: () => fetchProgress(service),
  };
};

/**
 * Hook that returns the progress for a given service
 *
 * @param service - Service to retrieve the progress from
 * @param options - Query options
 * @returns Progress information or undefined if unknown
 */
const useProgress = (service: string, options?: QueryHookOptions): Progress | undefined => {
  const query = progressQuery(service);
  const func = options?.suspense ? useSuspenseQuery : useQuery;
  const { data } = func(query);
  return data;
};

/**
 * Hook that registers a useEffect to listen for progress changes
 *
 * It listens for all progress changes but updates only existing
 * progress queries.
 */
const useProgressChanges = () => {
  const client = useInstallerClient();
  const queryClient = useQueryClient();

  React.useEffect(() => {
    if (!client) return;

    return client.onEvent((event) => {
      if (event.type === "ProgressChanged") {
        const service = servicesMap[event.path];
        if (!service) {
          console.warn("Unknown progress path", event.path);
          return;
        }

        const data = queryClient.getQueryData(progressKeys.byService(service));
        if (data) {
          // NOTE: steps are not coming in the updates
          const steps = (data as Progress).steps;
          const fromEvent = Progress.fromApi(event);
          queryClient.setQueryData(progressKeys.byService(service), { ...fromEvent, steps });
        }
      }
    });
  }, [client, queryClient]);
};

/**
 * Hook that invalidates all the existing queries.
 *
 * It offers a way to clear previously cached progress information. It is expected to
 * be used before starting to display the progress.
 */
const useResetProgress = () => {
  const queryClient = useQueryClient();

  React.useEffect(() => {
    return () => {
      queryClient.invalidateQueries({ queryKey: progressKeys.all() });
    };
  }, [queryClient]);
};

export { useProgress, useProgressChanges, useResetProgress, progressQuery };
