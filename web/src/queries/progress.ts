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

import React from "react";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useInstallerClient } from "~/context/installer";
import { Progress } from "~/types/progress";

const servicesMap = {
  "org.opensuse.Agama.Manager1": "manager",
  "org.opensuse.Agama.Software1": "software",
  "org.opensuse.Agama.Storage1": "storage",
};

const progressQuery = (service: string) => {
  return {
    queryKey: ["progress", service],
    queryFn: () =>
      fetch(`/api/${service}/progress`)
        .then((res) => res.json())
        .then((body) => Progress.fromApi(body)),
  };
};

type UseProgressOptions = {
  suspense: boolean;
};

const useProgress = (service: string, options?: QueryHookOptions): Progress => {
  const query = progressQuery(service);
  const func = options?.suspense ? useSuspenseQuery : useQuery;
  const { data } = func(query);
  return data;
};

const useProgressChanges = () => {
  const client = useInstallerClient();
  const queryClient = useQueryClient();

  React.useEffect(() => {
    if (!client) return;

    return client.ws().onEvent((event) => {
      if (event.type === "Progress") {
        const service = servicesMap[event.service];
        if (!service) {
          console.warn("Unknown service", event.service);
          return;
        }

        const data = queryClient.getQueryData(["progress", service]);
        if (data) {
          // NOTE: steps are not coming in the updates
          const steps = (data as Progress).steps;
          const fromEvent = Progress.fromApi(event);
          queryClient.setQueryData(["progress", service], { ...fromEvent, steps });
        }
      }
    });
  }, [client, queryClient]);
};

const useResetProgress = () => {
  const queryClient = useQueryClient();

  React.useEffect(() => {
    return () => {
      queryClient.invalidateQueries({ queryKey: ["progress"] });
    };
  }, []);
};

export { useProgress, useProgressChanges, useResetProgress, progressQuery };
